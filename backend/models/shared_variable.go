package models

import (
	"time"

	"gorm.io/gorm"
)

type SharedVariable struct {
	ID               uint           `gorm:"primaryKey" json:"id"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
	Name             string         `gorm:"uniqueIndex:idx_name_org" json:"name"`
	Value            string         `gorm:"type:text" json:"value"`
	SourceType       string         `json:"source_type"` // "manual", "api", "webpage"
	SourceURL        string         `json:"source_url"`
	ExtractionMethod string         `json:"extraction_method"` // "text", "json"
	ExtractionConfig string         `json:"extraction_config"` // Selector (CSS) or JSON Path
	RefreshInterval  int            `json:"refresh_interval"`  // In minutes
	LastRefreshed    *time.Time     `json:"last_refreshed"`
	OrganizationID   uint           `gorm:"uniqueIndex:idx_name_org" json:"organization_id"`
}
