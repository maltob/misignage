package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/maltob/misignage/auth"
	"github.com/maltob/misignage/db"
	"github.com/maltob/misignage/models"
	"github.com/maltob/misignage/storage"
)

type FileInfo struct {
	Name   string `json:"name"`
	Size   int64  `json:"size"`
	IsUsed bool   `json:"is_used"`
	URL    string `json:"url"`
}

func GetStorageFiles(c echo.Context) error {
	user := c.Get("user").(*auth.JwtCustomClaims)
	if user.Role != "admin" {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Unauthorized"})
	}

	files, err := os.ReadDir("uploads")
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to read storage"})
	}

	usedFiles := getUsedFilesMap()
	var result []FileInfo

	for _, f := range files {
		if f.IsDir() {
			continue
		}
		info, _ := f.Info()
		url := "/api/uploads/" + f.Name()
		result = append(result, FileInfo{
			Name:   f.Name(),
			Size:   info.Size(),
			URL:    url,
			IsUsed: usedFiles[url],
		})
	}

	return c.JSON(http.StatusOK, result)
}

func DeleteStorageFile(c echo.Context) error {
	user := c.Get("user").(*auth.JwtCustomClaims)
	if user.Role != "admin" {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Unauthorized"})
	}

	filename := c.Param("filename")
	if filename == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Filename required"})
	}

	err := storage.Provider.Delete(filename)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to delete file"})
	}

	return c.NoContent(http.StatusOK)
}

func CleanupStorage(c echo.Context) error {
	user := c.Get("user").(*auth.JwtCustomClaims)
	if user.Role != "admin" {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Unauthorized"})
	}

	files, err := os.ReadDir("uploads")
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to read storage"})
	}

	usedFiles := getUsedFilesMap()
	deletedCount := 0

	for _, f := range files {
		if f.IsDir() {
			continue
		}
		url := "/api/uploads/" + f.Name()
		if !usedFiles[url] {
			os.Remove(filepath.Join("uploads", f.Name()))
			deletedCount++
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"deleted_count": deletedCount,
	})
}

func getUsedFilesMap() map[string]bool {
	used := make(map[string]bool)

	// 1. Slides
	var slides []models.Slide
	db.DB.Find(&slides)
	for _, s := range slides {
		if s.ThumbnailURL != "" {
			used[s.ThumbnailURL] = true
		}

		var content map[string]string
		if err := json.Unmarshal([]byte(s.Content), &content); err == nil {
			if url, ok := content["url"]; ok {
				// Only if it's a local upload
				if strings.HasPrefix(url, "/api/uploads/") {
					used[url] = true
				}
			}
		}
	}

	// 2. Display Screenshots
	var displays []models.Display
	db.DB.Find(&displays)
	for _, d := range displays {
		if d.LastScreenshot != "" {
			used[d.LastScreenshot] = true
		}
	}

	return used
}
