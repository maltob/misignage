package db

import (
	"fmt"
	"os"

	"github.com/glebarez/sqlite"
	"github.com/user/misignage/auth"
	"github.com/user/misignage/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() {
	var err error
	dbType := os.Getenv("DB_TYPE")
	dsn := os.Getenv("DB_DSN")

	if dbType == "postgres" {
		DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	} else {
		// Default to SQLite
		if dsn == "" {
			dsn = "misignage.db"
		}
		DB, err = gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	}

	if err != nil {
		panic(fmt.Sprintf("Failed to connect to database: %v", err))
	}

	// Auto-migrate models
	err = DB.AutoMigrate(
		&models.Organization{},
		&models.User{},
		&models.Group{},
		&models.Display{},
		&models.Slide{},
		&models.Playlist{},
		&models.PlaylistSlide{},
		&models.Schedule{},
		&models.SystemLog{},
	)

	if err != nil {
		panic(fmt.Sprintf("Failed to migrate database: %v", err))
	}
}

func CaptureDisplayIP(id uint, ip string) {
	DB.Model(&models.Display{}).Where("id = ?", id).Update("ip_address", ip)
}

func Bootstrap() {
	var userCount int64
	DB.Model(&models.User{}).Count(&userCount)

	if userCount == 0 {
		fmt.Println("No users found. Bootstrapping initial organization and admin user...")

		// Create default organization
		org := models.Organization{Name: "Default Organization"}
		DB.Create(&org)

		// Create admin user
		email := os.Getenv("BOOTSTRAP_USER_EMAIL")
		if email == "" {
			email = "admin@misignage.local"
		}

		password := os.Getenv("BOOTSTRAP_USER_PASSWORD")
		if password == "" {
			password = "admin_password"
		}

		hash, _ := auth.HashPassword(password)

		user := models.User{
			Email:          email,
			PasswordHash:   hash,
			Role:           "admin",
			OrganizationID: org.ID,
		}
		DB.Create(&user)

		fmt.Printf("Bootstrap user created: %s / %s\n", email, password)
	}
}
