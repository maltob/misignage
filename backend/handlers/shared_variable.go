package handlers

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/labstack/echo/v4"
	"github.com/maltob/misignage/auth"
	"github.com/maltob/misignage/db"
	"github.com/maltob/misignage/models"
	"github.com/maltob/misignage/util"
	"github.com/tidwall/gjson"
)

func CreateSharedVariable(c echo.Context) error {
	userClaims := c.Get("user").(*auth.JwtCustomClaims)

	var input models.SharedVariable
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, echo.Map{"error": "Invalid input"})
	}

	input.OrganizationID = userClaims.OrganizationID

	// Initial fetch if it's an external source
	if input.SourceType == "api" || input.SourceType == "webpage" {
		val, err := fetchVariableValue(&input)
		if err == nil {
			input.Value = val
			now := time.Now()
			input.LastRefreshed = &now
		} else {
			util.LogErrorf(input.OrganizationID, "shared_vars", 0, "Failed initial fetch for variable %s: %v", input.Name, err)
			// We define that we create it anyway, but the value might be empty
		}
	} else {
		// Manual: just keep the value provided
	}

	if err := db.DB.Create(&input).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, echo.Map{"error": "Failed to create variable"})
	}

	util.LogAudit(c, "CREATE", "SHARED_VAR", input.ID, fmt.Sprintf("Created variable: %s", input.Name))
	return c.JSON(http.StatusCreated, input)
}

func GetSharedVariables(c echo.Context) error {
	userClaims := c.Get("user").(*auth.JwtCustomClaims)
	var vars []models.SharedVariable
	db.DB.Where("organization_id = ?", userClaims.OrganizationID).Find(&vars)
	return c.JSON(http.StatusOK, vars)
}

func UpdateSharedVariable(c echo.Context) error {
	id := c.Param("id")
	userClaims := c.Get("user").(*auth.JwtCustomClaims)

	var sv models.SharedVariable
	if err := db.DB.Where("id = ? AND organization_id = ?", id, userClaims.OrganizationID).First(&sv).Error; err != nil {
		return c.JSON(http.StatusNotFound, echo.Map{"error": "Variable not found"})
	}

	// Bind ONLY fields we want to allow updating
	type UpdateInput struct {
		Name             string `json:"name"`
		Value            string `json:"value"`
		SourceType       string `json:"source_type"`
		SourceURL        string `json:"source_url"`
		ExtractionMethod string `json:"extraction_method"`
		ExtractionConfig string `json:"extraction_config"`
		RefreshInterval  int    `json:"refresh_interval"`
	}
	var input UpdateInput
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, echo.Map{"error": "Invalid input"})
	}

	sv.Name = input.Name
	sv.SourceType = input.SourceType
	sv.SourceURL = input.SourceURL
	sv.ExtractionMethod = input.ExtractionMethod
	sv.ExtractionConfig = input.ExtractionConfig
	sv.RefreshInterval = input.RefreshInterval

	// If manual, just set the value
	if sv.SourceType == "manual" {
		sv.Value = input.Value
	} else {
		// If switching to/updating external, trigger a refresh
		val, err := fetchVariableValue(&sv)
		if err == nil {
			sv.Value = val
			now := time.Now()
			sv.LastRefreshed = &now
		} else {
			util.LogErrorf(sv.OrganizationID, "shared_vars", sv.ID, "Failed refresh during update: %v", err)
		}
	}

	if err := db.DB.Save(&sv).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, echo.Map{"error": "Failed to update variable"})
	}

	util.LogAudit(c, "UPDATE", "SHARED_VAR", sv.ID, fmt.Sprintf("Updated variable: %s", sv.Name))
	return c.JSON(http.StatusOK, sv)
}

func DeleteSharedVariable(c echo.Context) error {
	id := c.Param("id")
	userClaims := c.Get("user").(*auth.JwtCustomClaims)

	if err := db.DB.Where("id = ? AND organization_id = ?", id, userClaims.OrganizationID).Delete(&models.SharedVariable{}).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, echo.Map{"error": "Failed to delete variable"})
	}

	util.LogAudit(c, "DELETE", "SHARED_VAR", 0, fmt.Sprintf("Deleted variable ID: %s", id))
	return c.NoContent(http.StatusNoContent)
}

func TriggerRefreshSharedVariable(c echo.Context) error {
	id := c.Param("id")
	userClaims := c.Get("user").(*auth.JwtCustomClaims)

	var sv models.SharedVariable
	if err := db.DB.Where("id = ? AND organization_id = ?", id, userClaims.OrganizationID).First(&sv).Error; err != nil {
		return c.JSON(http.StatusNotFound, echo.Map{"error": "Variable not found"})
	}

	val, err := fetchVariableValue(&sv)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, echo.Map{"error": fmt.Sprintf("Fetch failed: %v", err)})
	}

	sv.Value = val
	now := time.Now()
	sv.LastRefreshed = &now
	db.DB.Save(&sv)

	return c.JSON(http.StatusOK, sv)
}

// Internal function to perform the fetching logic
func fetchVariableValue(sv *models.SharedVariable) (string, error) {
	if sv.SourceType == "manual" {
		return sv.Value, nil
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(sv.SourceURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("HTTP status %d", resp.StatusCode)
	}

	// Read body once
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if sv.ExtractionMethod == "json" {
		// Use gjson for efficient path extraction
		if !gjson.ValidBytes(bodyBytes) {
			return "", fmt.Errorf("invalid JSON response")
		}
		result := gjson.GetBytes(bodyBytes, sv.ExtractionConfig)
		// We return string representation
		return result.String(), nil
	} else if sv.ExtractionMethod == "image" {
		doc, err := goquery.NewDocumentFromReader(bytes.NewReader(bodyBytes))
		if err != nil {
			return "", err
		}

		selection := doc.Find(sv.ExtractionConfig)
		if selection.Length() == 0 {
			return "", fmt.Errorf("selector '%s' found no elements", sv.ExtractionConfig)
		}

		src, exists := selection.First().Attr("src")
		if !exists {
			return "", fmt.Errorf("element has no src attribute")
		}

		// Resolve relative URL
		baseURL, err := url.Parse(sv.SourceURL)
		if err != nil {
			return "", fmt.Errorf("invalid source URL: %v", err)
		}
		imgURL, err := baseURL.Parse(src)
		if err != nil {
			return "", fmt.Errorf("failed to resolve image URL: %v", err)
		}

		// Fetch image
		imgResp, err := client.Get(imgURL.String())
		if err != nil {
			return "", fmt.Errorf("failed to fetch image: %v", err)
		}
		defer imgResp.Body.Close()

		if imgResp.StatusCode < 200 || imgResp.StatusCode >= 300 {
			return "", fmt.Errorf("image fetch status %d", imgResp.StatusCode)
		}

		imgBytes, err := io.ReadAll(imgResp.Body)
		if err != nil {
			return "", err
		}

		mimeType := http.DetectContentType(imgBytes)
		b64 := base64.StdEncoding.EncodeToString(imgBytes)

		return fmt.Sprintf("data:%s;base64,%s", mimeType, b64), nil
	} else {
		// Assume HTML/Webpage
		if sv.ExtractionConfig == "" {
			return string(bodyBytes), nil
		}

		doc, err := goquery.NewDocumentFromReader(bytes.NewReader(bodyBytes))
		if err != nil {
			return "", err
		}

		// Find by selector
		selection := doc.Find(sv.ExtractionConfig)
		if selection.Length() == 0 {
			return "", fmt.Errorf("selector '%s' found no elements", sv.ExtractionConfig)
		}

		// Return text of first match? Or maybe loop? For now, first match text.
		return selection.First().Text(), nil
	}
}

// Public helper for worker
func StartVariableRefreshWorker() {
	go func() {
		// Initial check
		time.Sleep(10 * time.Second)
		checkAndRefreshVariables()

		ticker := time.NewTicker(1 * time.Minute)
		for range ticker.C {
			checkAndRefreshVariables()
		}
	}()
}

func checkAndRefreshVariables() {
	var vars []models.SharedVariable
	// Find vars where SourceType != manual AND (LastRefreshed IS NULL OR LastRefreshed + Interval < Now)
	now := time.Now()
	db.DB.Where("source_type != ? AND (last_refreshed IS NULL OR ? > last_refreshed + (refresh_interval * interval '1 minute'))", "manual", now).Find(&vars)

	// The GORM query above with interval math is tricky across DBs (SQLite vs Postgres).
	// Let's do it in code for safety and simplicity, fetching all non-manuals.
	// Optimization: filtering by time in code is OK for < 1000 vars.

	// Re-fetch all non-manual
	db.DB.Where("source_type != ?", "manual").Find(&vars)

	for _, v := range vars {
		shouldRefresh := false
		if v.LastRefreshed == nil {
			shouldRefresh = true
		} else {
			nextRefresh := v.LastRefreshed.Add(time.Duration(v.RefreshInterval) * time.Minute)
			if now.After(nextRefresh) {
				shouldRefresh = true
			}
		}

		if shouldRefresh {
			val, err := fetchVariableValue(&v)
			if err == nil {
				v.Value = val
				nowRef := time.Now()
				v.LastRefreshed = &nowRef
				db.DB.Save(&v)
				util.LogInfo(v.OrganizationID, "worker_vars", "Refreshed variable "+v.Name, 0)
			} else {
				util.LogErrorf(v.OrganizationID, "worker_vars", 0, "Failed auto-refresh variable %s: %v", v.Name, err)
			}
		}
	}
}
