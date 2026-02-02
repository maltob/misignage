package db

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"os"

	"github.com/glebarez/sqlite"
	"github.com/maltob/misignage/auth"
	"github.com/maltob/misignage/models"
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
		&models.User{}, &models.Group{}, &models.SlideTemplate{}, &models.Display{}, &models.Slide{},
		&models.Playlist{}, &models.PlaylistSlide{}, &models.Schedule{}, &models.SystemLog{},
		&models.APIKey{}, &models.ScreenshareSession{},
	)

	if err != nil {
		panic(fmt.Sprintf("Failed to migrate database: %v", err))
	}

	// Recovery fix for existing records that might be missing OrganizationID (set to 0)
	// This ensures they are visible to the default organization (ID 1)
	DB.Model(&models.Playlist{}).Where("organization_id = ?", 0).Update("organization_id", 1)
	DB.Model(&models.Slide{}).Where("organization_id = ?", 0).Update("organization_id", 1)
	DB.Model(&models.Display{}).Where("organization_id = ?", 0).Update("organization_id", 1)
	DB.Model(&models.Schedule{}).Where("organization_id = ?", 0).Update("organization_id", 1)
	DB.Model(&models.Group{}).Where("organization_id = ?", 0).Update("organization_id", 1)
}

func CaptureDisplayIP(id uint, ip string) {
	DB.Model(&models.Display{}).Where("id = ?", id).Update("ip_address", ip)
}

func generateReadablePassword() string {
	adjectives := []string{"Swift", "Brave", "Bright", "Cloudy", "Silent", "Indigo", "Emerald", "Golden", "Alpine", "Vibrant"}
	nouns := []string{"Eagle", "Forest", "Mountain", "River", "Shield", "Storm", "Beacon", "Canyon", "Peak", "Valley"}

	adjIndex, _ := rand.Int(rand.Reader, big.NewInt(int64(len(adjectives))))
	nounIndex, _ := rand.Int(rand.Reader, big.NewInt(int64(len(nouns))))
	num, _ := rand.Int(rand.Reader, big.NewInt(9999))

	return fmt.Sprintf("%s%s%d", adjectives[adjIndex.Int64()], nouns[nounIndex.Int64()], num.Int64())
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
		isAutoPassword := false
		if password == "" {
			password = generateReadablePassword()
			isAutoPassword = true
		}

		hash, _ := auth.HashPassword(password)

		user := models.User{
			Email:          email,
			PasswordHash:   hash,
			Role:           "admin",
			OrganizationID: org.ID,
		}
		DB.Create(&user)

		if isAutoPassword {
			fmt.Println("**********************************************************")
			fmt.Printf(" [INITIAL SETUP] Admin user created: %s\n", email)
			fmt.Printf(" [INITIAL SETUP] GENERATED PASSWORD: %s\n", password)
			fmt.Println(" [INITIAL SETUP] Please change this after login!")
			fmt.Println("**********************************************************")
		} else {
			fmt.Printf("Bootstrap user created: %s\n", email)
		}
	}

	var templateCount int64
	DB.Model(&models.SlideTemplate{}).Count(&templateCount)
	if templateCount == 0 {
		fmt.Println("No templates found. Seeding starter templates...")
		seedTemplates()
	}
}

func seedTemplates() {
	templates := []models.SlideTemplate{
		{
			Name: "Minimalist Digital Clock",
			HTML: `<div class="clock-container">
  <div id="time">00:00:00</div>
  <div id="date">JANUARY 1, 2026</div>
</div>`,
			CSS: `.clock-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: {{background}};
}
#time {
  font-size: {{fontSize}};
  font-weight: 900;
  color: {{color}};
  text-shadow: 0 0 20px rgba(255,255,255,0.2);
}
#date {
  font-size: 2rem;
  opacity: 0.5;
  margin-top: 1rem;
  letter-spacing: 0.5em;
  text-transform: uppercase;
}`,
			JS: `function update() {
  const now = new Date();
  document.getElementById('time').innerText = now.toLocaleTimeString([], { hour12: false });
  document.getElementById('date').innerText = now.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}
setInterval(update, 1000);
update();`,
			Variables: `[
  {"name": "background", "label": "Background Color", "type": "color", "default": "#000000"},
  {"name": "fontSize", "label": "Font Size", "type": "text", "default": "12rem"},
  {"name": "color", "label": "Text Color", "type": "color", "default": "#ffffff"}
]`,
			OrganizationID: 0, // Global/System Template
		},
		{
			Name: "Animated News Ticker",
			HTML: `<div class="ticker-wrap">
  <div class="ticker-label">{{label}}</div>
  <div class="ticker">
    <div class="ticker__item">{{message}}</div>
  </div>
</div>`,
			CSS: `.ticker-wrap {
  position: absolute;
  bottom: 0;
  width: 100%;
  overflow: hidden;
  height: 4rem;
  background-color: rgba(0, 0, 0, 0.9);
  padding-left: 100%;
  box-sizing: content-box;
  display: flex;
  align-items: center;
}
.ticker-label {
  position: absolute;
  left: 0;
  height: 100%;
  padding: 0 2rem;
  background: {{accent}};
  display: flex;
  align-items: center;
  font-weight: 900;
  z-index: 2;
  text-transform: uppercase;
}
.ticker {
  display: inline-block;
  height: 4rem;
  line-height: 4rem;
  white-space: nowrap;
  padding-right: 100%;
  box-sizing: content-box;
  animation: ticker 20s linear infinite;
}
.ticker__item {
  display: inline-block;
  padding: 0 2rem;
  font-size: 1.5rem;
  color: white;
}
@keyframes ticker {
  0% { transform: translate3d(0, 0, 0); }
  100% { transform: translate3d(-100%, 0, 0); }
}`,
			JS: ``,
			Variables: `[
  {"name": "label", "label": "Ticker Category", "type": "text", "default": "BREAKING NEWS"},
  {"name": "message", "label": "Ticker Message", "type": "text", "default": "MiSignage Custom HTML Slides are now live! Create rich content easily."},
  {"name": "accent", "label": "Accent Color", "type": "color", "default": "#6366f1"}
]`,
			OrganizationID: 0,
		},
		{
			Name: "Weather Forecast",
			HTML: `<div class="weather-container">
  <div class="weather-city">{{city}}</div>
  <div class="weather-temp">{{temp}}°C</div>
  <div class="weather-desc">{{condition}}</div>
</div>`,
			CSS: `.weather-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: linear-gradient(135deg, {{color1}}, {{color2}});
  color: white;
  text-shadow: 0 4px 10px rgba(0,0,0,0.3);
}
.weather-city {
  font-size: 3rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.2em;
}
.weather-temp {
  font-size: 10rem;
  font-weight: 900;
  margin: -1rem 0;
}
.weather-desc {
  font-size: 2rem;
  font-weight: 500;
  opacity: 0.8;
}`,
			JS: `// Note: In a real scenario, this would fetch from an API
// For this demo template, we'll just use the static variables.`,
			Variables: `[
  {"name": "city", "label": "City Name", "type": "text", "default": "NEW YORK"},
  {"name": "temp", "label": "Temperature", "type": "text", "default": "22"},
  {"name": "condition", "label": "Condition", "type": "text", "default": "PARTLY CLOUDY"},
  {"name": "color1", "label": "Gradient Color 1", "type": "color", "default": "#0ea5e9"},
  {"name": "color2", "label": "Gradient Color 2", "type": "color", "default": "#6366f1"}
]`,
			OrganizationID: 0,
		},
	}
	for _, t := range templates {
		DB.Create(&t)
	}
}
