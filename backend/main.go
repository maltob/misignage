package main

import (
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"net/http"
	"os"

	"strings"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/maltob/misignage/auth"
	"github.com/maltob/misignage/db"
	"github.com/maltob/misignage/handlers"
	"github.com/maltob/misignage/storage"
	"github.com/maltob/misignage/util"
)

//go:embed all:dist
var frontendDist embed.FS

func main() {
	debugFlag := flag.Bool("debug", false, "Enable debug console logging")
	flag.Parse()
	util.DebugMode = *debugFlag

	// Frontend Embedding
	distFs, _ := fs.Sub(frontendDist, "dist")

	db.InitDB()
	db.Bootstrap()
	storage.InitStorage()
	handlers.InitOIDC()
	handlers.InitWorker()
	handlers.ScanAndQueue()

	e := echo.New()

	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())

	// Public Routes
	e.GET("/login", func(c echo.Context) error {
		content, err := fs.ReadFile(distFs, "index.html")
		if err != nil {
			return err
		}
		return c.HTML(http.StatusOK, string(content))
	})
	e.POST("/login", func(c echo.Context) error {
		// Check if this is a form post with a token (OIDC callback)
		if c.Request().Header.Get("Content-Type") == "application/x-www-form-urlencoded" {
			token := c.FormValue("token")
			if token != "" {
				content, err := fs.ReadFile(distFs, "index.html")
				if err != nil {
					return err
				}
				html := string(content)
				// Inject token into HTML
				script := fmt.Sprintf("<script>window.INITIAL_TOKEN = '%s';</script>", token)
				html = strings.Replace(html, "<head>", "<head>"+script, 1)
				return c.HTML(http.StatusOK, html)
			}
		}
		return handlers.Login(c)
	})
	e.POST("/register", handlers.Register)
	e.POST("/api/displays/register", handlers.RegisterDisplay)
	e.POST("/api/displays/login", handlers.LoginDisplay)
	e.GET("/api/displays/:id/status", handlers.GetDisplayStatus)

	// OIDC Routes
	e.GET("/auth/:provider", handlers.BeginAuth)
	e.GET("/auth/:provider/callback", handlers.CompleteAuth)

	// API Routes (Protected)
	api := e.Group("/api")
	api.Use(handlers.APIKeyMiddleware) // Allow API Key auth
	api.Use(auth.JWTMiddleware)        // Fallback to JWT if API Key is not present/valid

	api.GET("/health", func(c echo.Context) error {
		return c.String(http.StatusOK, "OK")
	})

	// API Keys
	api.GET("/apikeys", handlers.GetAPIKeys)
	api.POST("/apikeys", handlers.CreateAPIKey)
	api.DELETE("/apikeys/:id", handlers.DeleteAPIKey)

	// External Variable Update (Slide)
	api.POST("/slides/:id/variables", handlers.UpdateSlideVariables)

	// Dashboard
	api.GET("/dashboard/stats", handlers.GetDashboardStats)

	// Display Routes
	api.GET("/displays", handlers.GetDisplays)
	api.GET("/displays/pending", handlers.GetPendingDisplays)
	api.POST("/displays/:id/approve", handlers.ApproveDisplay)
	api.POST("/displays/claim", handlers.ClaimDisplayByCode)
	api.POST("/displays/:id/command", handlers.SendDisplayCommand)
	api.POST("/displays/:id/heartbeat", handlers.ReportHeartbeat)
	api.GET("/displays/:id/content", handlers.GetDisplayContent)
	api.POST("/displays/:id/screenshot", handlers.UploadDisplayScreenshot)
	api.DELETE("/displays/:id", handlers.DeleteDisplay)
	api.PUT("/displays/:id", handlers.UpdateDisplay)

	// Slide Routes
	api.POST("/slides", handlers.CreateSlide)
	api.GET("/slides", handlers.GetSlides)
	api.PUT("/slides/:id", handlers.UpdateSlide)
	api.DELETE("/slides/:id", handlers.DeleteSlide)

	// Playlist Routes
	api.POST("/playlists", handlers.CreatePlaylist)
	api.GET("/playlists", handlers.GetPlaylists)
	api.PUT("/playlists/:id", handlers.UpdatePlaylist)
	api.DELETE("/playlists/:id", handlers.DeletePlaylist)
	api.POST("/playlists/:id/slides", handlers.AddSlideToPlaylist)
	api.PUT("/playlists/:id/slides", handlers.UpdatePlaylistSlides)

	// Schedule Routes
	api.POST("/schedules", handlers.CreateSchedule)
	api.GET("/schedules", handlers.GetSchedules)
	api.PUT("/schedules/:id", handlers.UpdateSchedule)
	api.DELETE("/schedules/:id", handlers.DeleteSchedule)
	// Group Routes
	api.POST("/groups", handlers.CreateGroup)
	api.GET("/groups", handlers.GetGroups)
	api.DELETE("/groups/:id", handlers.DeleteGroup)
	api.POST("/groups/:id/add", handlers.AddToGroup)
	api.POST("/groups/:id/remove", handlers.RemoveFromGroup)

	// Template Routes
	api.GET("/templates", handlers.GetTemplates)
	api.POST("/templates", handlers.CreateTemplate)
	api.DELETE("/templates/:id", handlers.DeleteTemplate)

	// Storage Management
	api.GET("/storage", handlers.GetStorageFiles)
	api.DELETE("/storage/:filename", handlers.DeleteStorageFile)
	api.POST("/storage/cleanup", handlers.CleanupStorage)

	// User Management
	api.GET("/users", handlers.GetUsers)
	api.POST("/users", handlers.CreateUser)
	api.PUT("/users/:id", handlers.UpdateUser)
	api.DELETE("/users/:id", handlers.DeleteUser)

	// Settings Management
	api.GET("/settings/org", handlers.GetOrgSettings)
	api.PUT("/settings/org", handlers.UpdateOrgSettings)
	api.PUT("/settings/profile", handlers.UpdateProfile)

	// Real-time
	e.GET("/ws", handlers.HandleWS)
	api.GET("/poll", handlers.HandlePoll)
	api.GET("/logs", handlers.GetSystemLogs)

	// Screenshare
	api.POST("/screenshare/direct", handlers.DirectJoinScreenshare)
	api.GET("/screenshare/code", handlers.RequestPairingCode)
	e.POST("/api/screenshare/join", handlers.JoinScreenshare) // Unauthenticated join via code
	e.POST("/api/screenshare/:id/signal", handlers.SignalSharer)
	e.GET("/api/screenshare/:id/receive", handlers.ReceiveSignal)
	e.GET("/api/screenshare/ice", handlers.GetIceServers)
	e.GET("/api/public/playlist/:slug", handlers.GetPublicPlaylist)
	e.GET("/api/public/playlist/:slug/search", handlers.SearchPublicPlaylist)

	// Static files for uploads (must be separate from frontend embed)
	e.Static("/api/uploads", "uploads")
	e.File("/openapi.yaml", "docs/openapi.yaml")
	e.File("/openapi.yml", "docs/openapi.yaml")
	e.GET("/docs", handlers.ServeDocs)

	// Support legacy /player route by redirecting to Hash route
	e.GET("/player", func(c echo.Context) error {
		return c.Redirect(http.StatusMovedPermanently, "/#/player")
	})

	e.StaticFS("/*", distFs)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	e.Logger.Fatal(e.Start(":" + port))
}
