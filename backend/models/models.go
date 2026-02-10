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
	IceProvider            string         `json:"ice_provider"`     // "default", "cloudflare"
	IceConfig              string         `json:"ice_config"`       // JSON, encrypted
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
	Groups         []Group        `gorm:"many2many:user_groups;" json:"groups"`
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
	Schedules      []Schedule     `gorm:"many2many:schedule_groups;" json:"schedules"`
}

type SlideTemplate struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
	Name           string         `json:"name"`
	HTML           string         `gorm:"type:text" json:"html"`
	CSS            string         `gorm:"type:text" json:"css"`
	JS             string         `gorm:"type:text" json:"js"`
	Variables      string         `gorm:"type:text" json:"variables"` // JSON schema/metadata
	ThumbURL       string         `json:"thumb_url"`
	OrganizationID uint           `json:"organization_id"`
}

type Display struct {
	ID                uint           `gorm:"primaryKey" json:"id"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
	Name              string         `json:"name"`
	Size              string         `json:"size"`
	BrowserAgent      string         `json:"browser_agent"`
	LastSeen          time.Time      `json:"last_seen"`
	Status            string         `json:"status"` // online, offline, idle
	RegistrationCode  string         `gorm:"index" json:"registration_code"`
	IPAddress         string         `json:"ip_address"`
	Approved          bool           `json:"approved"`
	LastScreenshot    string         `json:"last_screenshot"`
	Secret            string         `json:"-"` // Hashed secret
	OrganizationID    uint           `json:"organization_id"`
	Organization      *Organization  `gorm:"foreignKey:OrganizationID" json:"organization,omitempty"`
	Groups            []Group        `gorm:"many2many:group_displays;" json:"groups"`
	Schedules         []Schedule     `gorm:"many2many:schedule_displays;" json:"schedules"`
	ScreenshareCode   string         `json:"screenshare_code,omitempty"`              // Current active pairing code
	ScreenshareLimit  int            `json:"screenshare_limit"`                       // Max session length in min
	AllowLocalPairing bool           `json:"allow_local_pairing" gorm:"default:true"` // Toggle for player-side pairing code
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
	Groups           []Group        `gorm:"many2many:group_slides;" json:"groups"`
	IsScreenshare    bool           `json:"is_screenshare"` // If true, this slide IS a screenshare target
	OIDCRequired     bool           `json:"oidc_required"`  // Force OIDC even if guest is disabled org-wide
}

type Playlist struct {
	ID             uint            `gorm:"primaryKey" json:"id"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
	DeletedAt      gorm.DeletedAt  `gorm:"index" json:"-"`
	Name           string          `json:"name"`
	IsPublic       bool            `json:"is_public"`
	PublicSlug     string          `gorm:"index" json:"public_slug"`
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

type APIKey struct {
	ID             uint       `gorm:"primaryKey" json:"id"`
	CreatedAt      time.Time  `json:"created_at"`
	Name           string     `json:"name"`
	Key            string     `gorm:"uniqueIndex" json:"-"` // Hashed key, hidden from JSON
	Prefix         string     `json:"prefix"`               // First 8 chars for identification
	OrganizationID uint       `json:"organization_id"`
	UserID         uint       `json:"user_id"`
	LastUsedAt     *time.Time `json:"last_used_at"`
	ExpiresAt      *time.Time `json:"expires_at"`
}

type ScreenshareSession struct {
	ID             uint        `gorm:"primaryKey" json:"id"`
	CreatedAt      time.Time   `json:"created_at"`
	EndedAt        *time.Time  `json:"ended_at,omitempty"`
	Code           string      `gorm:"index" json:"code"`
	DisplayID      uint        `json:"display_id"`
	SlideID        *uint       `json:"slide_id,omitempty"` // If triggered via a slide
	UserID         *uint       `json:"user_id,omitempty"`  // If authenticated via OIDC
	GuestName      string      `json:"guest_name,omitempty"`
	OrganizationID uint        `json:"organization_id"`
	IsActive       bool        `gorm:"default:true" json:"is_active"`
	SignalChannel  chan string `gorm:"-" json:"-"` // For live signaling bridge
}
