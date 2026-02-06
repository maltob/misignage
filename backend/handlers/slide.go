package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/maltob/misignage/auth"
	"github.com/maltob/misignage/db"
	"github.com/maltob/misignage/models"
	"github.com/maltob/misignage/storage"
	"github.com/maltob/misignage/util"
)

func CreateSlide(c echo.Context) error {
	user := c.Get("user").(*auth.JwtCustomClaims)
	name := c.FormValue("name")
	slideType := c.FormValue("type")

	var content string

	if slideType == "image" || slideType == "video" {
		file, err := c.FormFile("file")
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "No file uploaded"})
		}
		src, err := file.Open()
		if err != nil {
			return err
		}
		defer src.Close()

		filename := fmt.Sprintf("%d_%s", time.Now().Unix(), filepath.Base(file.Filename))
		path, err := storage.Provider.Save(filename, src)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to save file"})
		}

		contentMap := map[string]string{"url": storage.Provider.GetURL(path)}
		jsonContent, _ := json.Marshal(contentMap)
		content = string(jsonContent)
	} else if slideType == "webpage" {
		url := c.FormValue("content")
		contentMap := map[string]string{"url": url}
		jsonContent, _ := json.Marshal(contentMap)
		content = string(jsonContent)
	} else if slideType == "html" {
		// content is expected to be a JSON string of {html: "", css: "", js: "", variables: {}}
		content = c.FormValue("content")
	} else {
		// For tables or other text-based content, ensure it's valid JSON
		rawContent := c.FormValue("content")
		if !json.Valid([]byte(rawContent)) {
			// If not valid JSON, wrap it in a simple object
			contentMap := map[string]string{"data": rawContent}
			jsonContent, _ := json.Marshal(contentMap)
			content = string(jsonContent)
		} else {
			content = rawContent
		}
	}

	renderInterval, _ := strconv.Atoi(c.FormValue("render_interval"))
	renderDelay, _ := strconv.Atoi(c.FormValue("render_delay"))
	slide := models.Slide{
		Name:           name,
		Type:           slideType,
		Content:        content,
		ScaleMode:      c.FormValue("scale_mode"),
		RenderWebpage:  c.FormValue("render_webpage") == "true",
		RenderInterval: renderInterval,
		RenderDelay:    renderDelay,
		WebScript:      c.FormValue("web_script"),
		OrganizationID: user.OrganizationID,
	}

	if slide.Type == "video" || slide.Type == "image" || (slide.Type == "webpage" && slide.RenderWebpage) {
		slide.ProcessingStatus = "pending"
	}

	if err := db.DB.Create(&slide).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create slide"})
	}

	if slide.ProcessingStatus == "pending" {
		util.LogInfof(slide.OrganizationID, "slide", slide.ID, "Queueing immediate processing for slide %d (%s)", slide.ID, slide.Type)
		QueueProcessingTask(slide.ID)
	}

	// Assign groups if provided
	if groupIDs := c.Request().Form["group_ids[]"]; len(groupIDs) > 0 {
		var groups []models.Group
		db.DB.Where("id IN ?", groupIDs).Find(&groups)
		db.DB.Model(&slide).Association("Groups").Replace(groups)
	}

	util.LogAudit(c, "CREATE", "SLIDE", slide.ID, fmt.Sprintf("Created slide: %s (%s)", slide.Name, slide.Type))
	NotifyDashboard("slide_created", slide)
	return c.JSON(http.StatusCreated, slide)
}

func GetSlides(c echo.Context) error {
	user := c.Get("user").(*auth.JwtCustomClaims)
	query := c.QueryParam("q")

	var slides []models.Slide
	dbQuery := db.DB.Where("organization_id = ?", user.OrganizationID)

	if user.Role != "admin" {
		if len(user.GroupIDs) > 0 {
			dbQuery = dbQuery.Joins("JOIN group_slides ON group_slides.slide_id = slides.id").
				Where("group_slides.group_id IN ?", user.GroupIDs)
		} else {
			return c.JSON(http.StatusOK, []models.Slide{})
		}
	}

	if query != "" {
		likeQuery := "%" + query + "%"
		dbQuery = dbQuery.Where("name LIKE ? OR ocr_content LIKE ?", likeQuery, likeQuery)
	}

	dbQuery.Order("created_at DESC").Preload("Groups").Find(&slides)
	return c.JSON(http.StatusOK, slides)
}

func UpdateSlide(c echo.Context) error {
	id := c.Param("id")
	user := c.Get("user").(*auth.JwtCustomClaims)
	var slide models.Slide
	if err := db.DB.Where("id = ? AND organization_id = ?", id, user.OrganizationID).First(&slide).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Slide not found"})
	}

	name := c.FormValue("name")
	if name != "" {
		slide.Name = name
	}

	ocrContent := c.FormValue("ocr_content")
	if ocrContent != "" || c.Request().Form.Has("ocr_content") {
		slide.OCRContent = ocrContent
	}

	scaleMode := c.FormValue("scale_mode")
	if scaleMode != "" {
		slide.ScaleMode = scaleMode
	}

	oldContent := slide.Content
	oldRenderWebpage := slide.RenderWebpage
	oldWebScript := slide.WebScript
	contentChanged := false

	// Handle file upload for updates
	if slide.Type == "image" || slide.Type == "video" {
		file, err := c.FormFile("file")
		if err == nil {
			// New file uploaded
			src, err := file.Open()
			if err == nil {
				defer src.Close()

				// Delete old file if it was local
				var oldContentMap map[string]string
				if err := json.Unmarshal([]byte(oldContent), &oldContentMap); err == nil {
					if url, ok := oldContentMap["url"]; ok {
						storage.Provider.Delete(filepath.Base(url))
					}
				}

				// Save new file
				filename := fmt.Sprintf("%d_%s", time.Now().Unix(), filepath.Base(file.Filename))
				path, err := storage.Provider.Save(filename, src)
				if err == nil {
					contentMap := map[string]string{"url": storage.Provider.GetURL(path)}
					jsonContent, _ := json.Marshal(contentMap)
					slide.Content = string(jsonContent)
					contentChanged = true

					// Reset processing fields for re-generation
					slide.OCRContent = ""
					slide.ThumbnailURL = ""
					slide.ProcessingStatus = "pending"
				}
			}
		}
	} else if slide.Type == "webpage" || slide.Type == "table" {
		rawContent := c.FormValue("content")
		if rawContent != "" {
			var newContent string
			if slide.Type == "webpage" {
				contentMap := map[string]string{"url": rawContent}
				jsonContent, _ := json.Marshal(contentMap)
				newContent = string(jsonContent)
			} else {
				if !json.Valid([]byte(rawContent)) {
					contentMap := map[string]string{"data": rawContent}
					jsonContent, _ := json.Marshal(contentMap)
					newContent = string(jsonContent)
				} else {
					newContent = rawContent
				}
			}
			if newContent != oldContent {
				slide.Content = newContent
				contentChanged = true
			}
		}
	}

	if c.FormValue("render_webpage") != "" {
		newRenderWebpage := c.FormValue("render_webpage") == "true"
		if newRenderWebpage != oldRenderWebpage {
			slide.RenderWebpage = newRenderWebpage
			contentChanged = true
		}
	}
	if c.FormValue("render_interval") != "" {
		interval, _ := strconv.Atoi(c.FormValue("render_interval"))
		slide.RenderInterval = interval
	}
	if c.FormValue("web_script") != "" {
		newWebScript := c.FormValue("web_script")
		if newWebScript != oldWebScript {
			slide.WebScript = newWebScript
			contentChanged = true
		}
	}
	if c.FormValue("render_delay") != "" {
		delay, _ := strconv.Atoi(c.FormValue("render_delay"))
		if delay != slide.RenderDelay {
			slide.RenderDelay = delay
			contentChanged = true
		}
	}

	if err := db.DB.Save(&slide).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to update slide"})
	}

	// Trigger re-processing if content changed and it's a processable type
	if contentChanged {
		if slide.Type == "video" || slide.Type == "image" || (slide.Type == "webpage" && slide.RenderWebpage) {
			slide.ProcessingStatus = "pending"
			db.DB.Model(&slide).Update("processing_status", "pending")
			QueueProcessingTask(slide.ID)
		}
	}

	// Update groups if provided
	if groupIDs := c.Request().Form["group_ids[]"]; len(groupIDs) > 0 {
		var groups []models.Group
		db.DB.Where("id IN ?", groupIDs).Find(&groups)
		db.DB.Model(&slide).Association("Groups").Replace(groups)
	} else if c.FormValue("group_ids_cleared") == "true" {
		db.DB.Model(&slide).Association("Groups").Clear()
	}

	util.LogAudit(c, "UPDATE", "SLIDE", slide.ID, fmt.Sprintf("Updated slide: %s", slide.Name))
	NotifyDashboard("slide_updated", slide)
	return c.JSON(http.StatusOK, slide)
}

func DeleteSlide(c echo.Context) error {
	id := c.Param("id")
	user := c.Get("user").(*auth.JwtCustomClaims)

	var slide models.Slide
	if err := db.DB.Where("id = ? AND organization_id = ?", id, user.OrganizationID).First(&slide).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Slide not found"})
	}

	// Clean up assets if they exist
	if slide.Type == "image" || slide.Type == "video" {
		var content map[string]string
		if err := json.Unmarshal([]byte(slide.Content), &content); err == nil {
			if url, ok := content["url"]; ok {
				filename := filepath.Base(url)
				storage.Provider.Delete(filename)
			}
		}
	}

	// Clean up thumbnail
	if slide.ThumbnailURL != "" {
		filename := filepath.Base(slide.ThumbnailURL)
		storage.Provider.Delete(filename)
	}

	if err := db.DB.Delete(&slide).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to delete slide"})
	}

	util.LogAudit(c, "DELETE", "SLIDE", slide.ID, fmt.Sprintf("Deleted slide: %s", slide.Name))
	NotifyDashboard("slide_deleted", map[string]interface{}{"id": slide.ID})
	return c.NoContent(http.StatusNoContent)
}

func UpdateSlideVariables(c echo.Context) error {
	userClaims := c.Get("user").(*auth.JwtCustomClaims)
	id := c.Param("id")

	var slide models.Slide
	if err := db.DB.Where("id = ? AND organization_id = ?", id, userClaims.OrganizationID).First(&slide).Error; err != nil {
		return c.JSON(http.StatusNotFound, echo.Map{"error": "Slide not found"})
	}

	if slide.Type != "html" {
		return c.JSON(http.StatusBadRequest, echo.Map{"error": "Only HTML slides support variable updates via this API"})
	}

	// Parse incoming variables
	var newVars map[string]interface{}
	if err := c.Bind(&newVars); err != nil {
		return c.JSON(http.StatusBadRequest, echo.Map{"error": "Invalid variable format"})
	}

	// Load existing content
	var content map[string]interface{}
	if err := json.Unmarshal([]byte(slide.Content), &content); err != nil {
		return c.JSON(http.StatusInternalServerError, echo.Map{"error": "Failed to parse existing slide content"})
	}

	// Update variables
	existingVars, ok := content["variables"].(map[string]interface{})
	if !ok {
		existingVars = make(map[string]interface{})
	}

	for k, v := range newVars {
		existingVars[k] = v
	}
	content["variables"] = existingVars

	// Save back
	updatedContent, _ := json.Marshal(content)
	slide.Content = string(updatedContent)

	if err := db.DB.Save(&slide).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, echo.Map{"error": "Failed to update slide"})
	}

	util.LogAudit(c, "UPDATE_VARS", "SLIDE", slide.ID, fmt.Sprintf("Updated variables for slide: %s", slide.Name))
	NotifyDashboard("slide_updated", slide)

	return c.JSON(http.StatusOK, slide)
}
