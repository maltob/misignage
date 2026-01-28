package handlers

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"time"

	"github.com/user/misignage/db"
	"github.com/user/misignage/models"
	"github.com/user/misignage/storage"
	"github.com/user/misignage/util"
)

type RetentionPolicy struct {
	UserUploadRetention   int            `json:"user_upload_retention"`   // Days
	SystemUploadRetention int            `json:"system_upload_retention"` // Days
	LogRetention          map[string]int `json:"log_retention"`           // Source -> Days
}

func PerformCleanup(orgID uint) {
	util.LogInfo(orgID, "worker", "Starting periodic cleanup...", 0)

	var org models.Organization
	if err := db.DB.First(&org, orgID).Error; err != nil {
		util.LogError(orgID, "worker", fmt.Sprintf("Cleanup failed, org not found: %v", err), 0)
		return
	}

	// Parse Policy
	policy := RetentionPolicy{
		UserUploadRetention:   30, // Default 30 days
		SystemUploadRetention: 1,  // Default 1 day
		LogRetention: map[string]int{
			"audit":  30, // Default 30 days for audit
			"worker": 7,  // Default 7 days for worker logs
			"api":    7,
			"burp":   7,
		},
	}

	if org.RetentionPolicy != "" {
		json.Unmarshal([]byte(org.RetentionPolicy), &policy)
	}

	// 1. Cleanup Logs
	for source, days := range policy.LogRetention {
		if days <= 0 {
			continue // 0 means forever
		}
		cutoff := time.Now().AddDate(0, 0, -days)
		db.DB.Where("organization_id = ? AND source = ? AND created_at < ?", orgID, source, cutoff).Delete(&models.SystemLog{})
	}
	// Also cleanup logs with unknown sources if needed, or apply a default.
	// For now, let's stick to explicitly defined sources in the map.

	// 2. Cleanup Trash (Soft Deleted Slides)
	cleanupTrash(orgID, policy)
}

func cleanupTrash(orgID uint, policy RetentionPolicy) {
	var slides []models.Slide
	// Find ALL soft-deleted slides for this org
	db.DB.Unscoped().Where("organization_id = ? AND deleted_at IS NOT NULL", orgID).Find(&slides)

	for _, slide := range slides {
		// Calculate retention based on type
		days := policy.SystemUploadRetention
		if slide.Type == "image" || slide.Type == "video" {
			days = policy.UserUploadRetention
		}

		if days <= 0 {
			continue
		}

		// Check if it's old enough to be hard deleted
		// user.DeletedAt is a gorm.DeletedAt which wraps a Time
		if time.Since(slide.DeletedAt.Time) > time.Duration(days)*24*time.Hour {
			hardDeleteSlide(slide)
		}
	}
}

func hardDeleteSlide(slide models.Slide) {
	// 1. Remove files
	if slide.Type == "image" || slide.Type == "video" || slide.Type == "webpage" {
		// Try to parse content to get URL
		var content map[string]string
		if err := json.Unmarshal([]byte(slide.Content), &content); err == nil {
			if url, ok := content["url"]; ok {
				filename := filepath.Base(url)
				// Extra safety: only delete if it looks like a file we own
				if len(filename) > 0 && filename != "." && filename != "/" {
					storage.Provider.Delete(filename)
				}
			}
		}
	}

	// Remove Thumbnail
	if slide.ThumbnailURL != "" {
		filename := filepath.Base(slide.ThumbnailURL)
		if len(filename) > 0 {
			storage.Provider.Delete(filename)
		}
	}

	// 2. Hard Delete from DB
	if err := db.DB.Unscoped().Delete(&slide).Error; err != nil {
		util.LogError(slide.OrganizationID, "worker", fmt.Sprintf("Failed to hard delete slide %d: %v", slide.ID, err), slide.ID)
	} else {
		util.LogInfo(slide.OrganizationID, "worker", fmt.Sprintf("Hard deleted expired slide %d (%s)", slide.ID, slide.Name), slide.ID)
	}
}
