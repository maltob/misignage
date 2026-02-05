package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"os"

	"github.com/chromedp/chromedp"
	"github.com/maltob/misignage/automation"
	"github.com/maltob/misignage/db"
	"github.com/maltob/misignage/models"
	"github.com/maltob/misignage/storage"
	"github.com/maltob/misignage/util"
)

type ProcessingTask struct {
	SlideID uint
}

var (
	processQueue = make(chan ProcessingTask, 100)
)

func InitWorker() {
	go func() {
		util.LogInfo(0, "worker", "Background Worker started (Video + OCR + WebRender)", 0)
		for task := range processQueue {
			processSlide(task.SlideID)
		}
	}()

	// Periodic scanner for re-rendering webpages
	go func() {
		ticker := time.NewTicker(15 * time.Second)
		cleanupTicker := time.NewTicker(1 * time.Hour)
		for {
			select {
			case <-ticker.C:
				scanAndQueuePeriodic()
			case <-cleanupTicker.C:
				var orgs []models.Organization
				db.DB.Find(&orgs)
				for _, org := range orgs {
					PerformCleanup(org.ID)
				}
			}
		}
	}()
}

func QueueProcessingTask(slideID uint) {
	// Mark as pending in DB first
	db.DB.Model(&models.Slide{}).Where("id = ?", slideID).Update("processing_status", "pending")
	processQueue <- ProcessingTask{SlideID: slideID}
}

func ScanAndQueue() {
	var slides []models.Slide
	db.DB.Where("((type = ? OR type = ?) AND (processing_status = ? OR processing_status = ?)) OR (type = ? AND render_webpage = ? AND (processing_status = ? OR processing_status = ?))",
		"video", "image", "pending", "processing", "webpage", true, "pending", "processing").Find(&slides)
	util.LogInfof(1, "worker", 0, "Found %d pending tasks to resume", len(slides))
	for _, s := range slides {
		processQueue <- ProcessingTask{SlideID: s.ID}
	}
}

func scanAndQueuePeriodic() {
	var slides []models.Slide
	// Find webpage slides that need re-rendering
	// Logic: type = webpage AND render_webpage = true AND render_interval > 0
	// AND (updated_at + render_interval < now)
	db.DB.Where("type = ? AND render_webpage = ? AND render_interval > 0", "webpage", true).Find(&slides)

	for _, s := range slides {
		nextRun := s.UpdatedAt.Add(time.Duration(s.RenderInterval) * time.Second)
		if time.Now().After(nextRun) && s.ProcessingStatus != "processing" {
			QueueProcessingTask(s.ID)
		}
	}
}

func processSlide(slideID uint) {
	var slide models.Slide
	if err := db.DB.First(&slide, slideID).Error; err != nil {
		util.LogErrorf(0, "worker", slideID, "Worker error: slide %d not found", slideID)
		return
	}

	db.DB.Model(&slide).Update("processing_status", "processing")

	if slide.Type == "video" {
		processVideoTask(&slide)
	} else if slide.Type == "image" {
		processImageTask(&slide)
	} else if slide.Type == "webpage" && slide.RenderWebpage {
		processWebpageTask(&slide)
	} else {
		updateStatus(slideID, "completed")
	}
}

func processVideoTask(slide *models.Slide) {
	localPath, err := getLocalPath(slide.Content)
	if err != nil {
		util.LogErrorf(slide.OrganizationID, "worker", slide.ID, "Worker error for slide %d: %v", slide.ID, err)
		updateStatus(slide.ID, "failed")
		return
	}

	// 1. Get Duration
	duration, _ := getVideoDuration(localPath)

	// 2. Extract Thumbnail
	thumbName := fmt.Sprintf("thumb_%d_%d.jpg", slide.ID, time.Now().Unix())
	thumbPath := filepath.Join("uploads", thumbName)
	err = extractThumbnail(localPath, thumbPath, duration/2)

	ocrText := ""
	if err == nil {
		// 3. OCR on Thumbnail (if enabled)
		var org models.Organization
		if db.DB.First(&org, slide.OrganizationID).Error == nil && org.EnableOCR {
			ocrText, _ = runOCR(thumbPath)
		}
	}

	// Update DB
	updates := map[string]interface{}{
		"duration":          duration,
		"ocr_content":       ocrText,
		"processing_status": "completed",
	}
	if err == nil {
		updates["thumbnail_url"] = "/api/uploads/" + thumbName
	}

	db.DB.Model(slide).Updates(updates)
}

func processImageTask(slide *models.Slide) {
	localPath, err := getLocalPath(slide.Content)
	if err != nil {
		util.LogErrorf(slide.OrganizationID, "worker", slide.ID, "Worker error for slide %d: %v", slide.ID, err)
		updateStatus(slide.ID, "failed")
		return
	}

	// Run OCR (if enabled)
	ocrText := ""
	var org models.Organization
	if db.DB.First(&org, slide.OrganizationID).Error == nil && org.EnableOCR {
		ocrText, err = runOCR(localPath)
	}

	status := "completed"
	if err != nil {
		util.LogErrorf(slide.OrganizationID, "worker", slide.ID, "OCR failed for slide %d: %v", slide.ID, err)
		// We don't fail the whole slide just because OCR failed
	}

	db.DB.Model(slide).Updates(map[string]interface{}{
		"ocr_content":       ocrText,
		"processing_status": status,
	})
}

func processWebpageTask(slide *models.Slide) {
	var content map[string]string
	if err := json.Unmarshal([]byte(slide.Content), &content); err != nil {
		util.LogErrorf(slide.OrganizationID, "worker", slide.ID, "Worker error for slide %d: invalid content", slide.ID)
		updateStatus(slide.ID, "failed")
		return
	}
	url := content["url"]
	if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
		url = "https://" + url
	}

	thumbName := fmt.Sprintf("web_%d_%d.png", slide.ID, time.Now().Unix())
	thumbPath := filepath.Join("uploads", thumbName)

	absPath, _ := filepath.Abs(thumbPath)
	os.MkdirAll("uploads", 0755)

	// Check for Chrome/Chromium availability
	hasChrome := false
	for _, app := range []string{"chromium", "chromium-browser", "google-chrome", "google-chrome-stable"} {
		if _, err := exec.LookPath(app); err == nil {
			hasChrome = true
			break
		}
	}
	if !hasChrome {
		util.LogInfof(slide.OrganizationID, "worker", slide.ID, "WARNING: Chrome/Chromium not found in PATH. Web render may fail if not found by chromedp auto-discovery.")
	}

	// Setup chromedp
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.WindowSize(1920, 1080),
		chromedp.NoSandbox,
	)

	allocCtx, cancel := chromedp.NewExecAllocator(context.Background(), opts...)
	defer cancel()

	ctx, cancel := chromedp.NewContext(allocCtx, chromedp.WithLogf(func(format string, v ...interface{}) {
		util.LogInfof(slide.OrganizationID, "worker", slide.ID, format, v...)
	}))
	defer cancel()

	// Timeout for the entire process
	ctx, cancel = context.WithTimeout(ctx, 90*time.Second)
	defer cancel()

	var buf []byte
	var err error

	if slide.WebScript != "" {
		util.LogInfof(slide.OrganizationID, "worker", slide.ID, "Executing Burp script for slide %d", slide.ID)
		err = automation.RunBurpScript(ctx, slide.WebScript, url, slide.OrganizationID, slide.ID)
		if err == nil {
			// Pause to allow final rendering/animations to settle
			delay := 2 * time.Second
			if slide.RenderDelay > 0 {
				delay = time.Duration(slide.RenderDelay) * time.Second
			}
			err = chromedp.Run(ctx,
				chromedp.Sleep(delay),
				chromedp.FullScreenshot(&buf, 90),
			)
		}
	} else {
		delay := 2 * time.Second
		if slide.RenderDelay > 0 {
			delay = time.Duration(slide.RenderDelay) * time.Second
		}
		util.LogInfof(slide.OrganizationID, "worker", slide.ID, "Rendering standard webpage for slide %d: %s", slide.ID, url)
		err = chromedp.Run(ctx,
			chromedp.Navigate(url),
			chromedp.Sleep(delay), // Wait for initial render
			chromedp.FullScreenshot(&buf, 90),
		)
	}

	if err != nil {
		util.LogErrorf(slide.OrganizationID, "worker", slide.ID, "Web render failed for slide %d: %v", slide.ID, err)
		updateStatus(slide.ID, "failed")
		return
	}

	if err := os.WriteFile(absPath, buf, 0644); err != nil {
		util.LogErrorf(slide.OrganizationID, "worker", slide.ID, "Failed to write screenshot for slide %d: %v", slide.ID, err)
		updateStatus(slide.ID, "failed")
		return
	}

	util.LogInfof(slide.OrganizationID, "worker", slide.ID, "Web render SUCCESS for slide %d: generated %s", slide.ID, thumbName)

	// Cleanup old thumbnail if it exists
	if slide.ThumbnailURL != "" {
		oldFilename := filepath.Base(slide.ThumbnailURL)
		if oldFilename != thumbName {
			storage.Provider.Delete(oldFilename)
		}
	}

	db.DB.Model(slide).Updates(map[string]interface{}{
		"thumbnail_url":     "/api/uploads/" + thumbName,
		"processing_status": "completed",
	})
}

func getLocalPath(contentStr string) (string, error) {
	var content map[string]string
	if err := json.Unmarshal([]byte(contentStr), &content); err != nil {
		return "", err
	}
	url := content["url"]
	if len(url) > 12 && url[:12] == "/api/uploads" {
		return filepath.Join("uploads", filepath.Base(url)), nil
	}
	return "", fmt.Errorf("not a local file: %s", url)
}

func runOCR(imagePath string) (string, error) {
	// tesseract [input] stdout
	cmd := exec.Command("tesseract", imagePath, "stdout")
	var out bytes.Buffer
	cmd.Stdout = &out
	err := cmd.Run()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(out.String()), nil
}

func updateStatus(id uint, status string) {
	db.DB.Model(&models.Slide{}).Where("id = ?", id).Update("processing_status", status)
}

func getVideoDuration(path string) (float64, error) {
	cmd := exec.Command("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path)
	var out bytes.Buffer
	cmd.Stdout = &out
	err := cmd.Run()
	if err != nil {
		return 0, err
	}
	return strconv.ParseFloat(string(bytes.TrimSpace(out.Bytes())), 64)
}

func extractThumbnail(videoPath, thumbPath string, time float64) error {
	cmd := exec.Command("ffmpeg", "-y", "-ss", fmt.Sprintf("%.2f", time), "-i", videoPath, "-vframes", "1", "-q:v", "4", thumbPath)
	return cmd.Run()
}
