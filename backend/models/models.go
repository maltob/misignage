package models

import (
	"time"

	"gorm.io/gorm"
)

type Organization struct {
	ID                     uint           `gorm:"primaryKey" json:"id"`
	CreatedAt              time.Time      `json:"created_at"`
	UpdatedAt              time.Time      `json:"updated_at"`
	DeletedAt              gorm.DeletedAt `gorm:"index" json:"-"`
	Name                   string         `json:"name"`
	EnableOCR              bool           `json:"enable_ocr"`
	ScreenshotInterval     int            `json:"screenshot_interval"` // In minutes, 0 to disable
	AllowOIDCAutoProvision bool           `json:"allow_oidc_auto_provision"`
	OIDCDomain             string         `json:"oidc_domain"`      // e.g. "company.com"
	RetentionPolicy        string         `json:"retention_policy"` // JSON: {user_uploads: 30, system_uploads: 1, logs: {audit: 90, worker: 7}}
	Users                  []User         `json:"users"`
}

type User struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
	Email          string         `gorm:"uniqueIndex" json:"email"`
	PasswordHash   string         `json:"-"`
	Role           string         `json:"role"` // admin, manager, viewer
	OrganizationID uint           `json:"organization_id"`
}

type Group struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
	Name           string         `json:"name"`
	OrganizationID uint           `json:"organization_id"`
	Displays       []Display      `gorm:"many2many:group_displays;" json:"displays"`
	Playlists      []Playlist     `gorm:"many2many:group_playlists;" json:"playlists"`
	Slides         []Slide        `gorm:"many2many:group_slides;" json:"slides"`
}

type Display struct {
	ID               uint           `gorm:"primaryKey" json:"id"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
	Name             string         `json:"name"`
	Size             string         `json:"size"`
	BrowserAgent     string         `json:"browser_agent"`
	LastSeen         time.Time      `json:"last_seen"`
	Status           string         `json:"status"` // online, offline, idle
	RegistrationCode string         `gorm:"index" json:"registration_code"`
	IPAddress        string         `json:"ip_address"`
	Approved         bool           `json:"approved"`
	LastScreenshot   string         `json:"last_screenshot"`
	Secret           string         `json:"-"` // Hashed secret
	OrganizationID   uint           `json:"organization_id"`
	Organization     *Organization  `gorm:"foreignKey:OrganizationID" json:"organization,omitempty"`
	Groups           []Group        `gorm:"many2many:group_displays;" json:"groups"`
}

type Slide struct {
	ID               uint           `gorm:"primaryKey" json:"id"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
	Name             string         `json:"name"`
	Type             string         `json:"type"`                     // image, video, table, webpage
	Content          string         `gorm:"type:text" json:"content"` // JSON payload
	ScaleMode        string         `json:"scale_mode"`               // fit, fill
	ThumbnailURL     string         `json:"thumbnail_url"`
	Duration         float64        `json:"duration"`
	ProcessingStatus string         `json:"processing_status"` // pending, processing, completed, failed
	OCRContent       string         `gorm:"type:text" json:"ocr_content"`
	RenderWebpage    bool           `json:"render_webpage"`
	RenderInterval   int            `json:"render_interval"` // In seconds, 0 to disable periodic re-render
	RenderDelay      int            `json:"render_delay"`    // In seconds, wait time before capture
	WebScript        string         `gorm:"type:text" json:"web_script"`
	OrganizationID   uint           `json:"organization_id"`
}

type Playlist struct {
	ID             uint            `gorm:"primaryKey" json:"id"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
	DeletedAt      gorm.DeletedAt  `gorm:"index" json:"-"`
	Name           string          `json:"name"`
	OrganizationID uint            `json:"organization_id"`
	Slides         []PlaylistSlide `json:"slides"`
	Groups         []Group         `gorm:"many2many:group_playlists;" json:"groups"`
}

type PlaylistSlide struct {
	ID         uint  `gorm:"primaryKey" json:"id"`
	PlaylistID uint  `json:"playlist_id"`
	SlideID    uint  `json:"slide_id"`
	Order      int   `json:"order"`
	Duration   int   `json:"duration"` // in seconds
	Slide      Slide `json:"slide"`
}

type Schedule struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
	PlaylistID     uint           `json:"playlist_id"`
	Playlist       Playlist       `gorm:"foreignKey:PlaylistID" json:"playlist"`
	OrganizationID uint           `json:"organization_id"`
	Groups         []Group        `gorm:"many2many:schedule_groups;" json:"groups"`
	Displays       []Display      `gorm:"many2many:schedule_displays;" json:"displays"`
	StartDate      *time.Time     `json:"start_date"`
	EndDate        *time.Time     `json:"end_date"`
	StartTime      string         `json:"start_time"`   // "HH:MM"
	EndTime        string         `json:"end_time"`     // "HH:MM"
	DaysOfWeek     int            `json:"days_of_week"` // bitmask 1=Mon, 2=Tue, etc
}

type SystemLog struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	CreatedAt      time.Time `json:"created_at"`
	OrganizationID uint      `json:"organization_id"`
	Source         string    `json:"source"` // "worker", "api", "audit"
	Level          string    `json:"level"`  // "info", "debug", "error"
	Message        string    `gorm:"type:text" json:"message"`
	SlideID        uint      `json:"slide_id,omitempty"`
	// Audit Fields
	UserID    *uint  `json:"user_id,omitempty"`
	Action    string `json:"action,omitempty"` // LOGIN, CREATE, UPDATE, DELETE
	Entity    string `json:"entity,omitempty"` // USER, SLIDE, etc.
	EntityID  uint   `json:"entity_id,omitempty"`
	IPAddress string `json:"ip_address,omitempty"`
}
