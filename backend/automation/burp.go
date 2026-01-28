package automation

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/chromedp/cdproto/target"
	"github.com/chromedp/chromedp"
	"github.com/chromedp/chromedp/kb"
	"github.com/user/misignage/util"
)

type BurpEvent struct {
	EventType  string `json:"eventType"`
	URL        string `json:"url,omitempty"`
	XPath      string `json:"xPath,omitempty"`
	TypedValue string `json:"typedValue,omitempty"`
	Key        string `json:"key,omitempty"`
	ScrollX    int    `json:"scrollX,omitempty"`
	ScrollY    int    `json:"scrollY,omitempty"`
	FrameId    int    `json:"frameId,omitempty"`
	IsIframe   bool   `json:"isIframe,omitempty"`
}

type BurpIframe struct {
	FrameId int    `json:"frameId"`
	XPath   string `json:"xPath"`
}

type BurpTopLevelEvent struct {
	EventType string       `json:"eventType"`
	Iframes   []BurpIframe `json:"iframes,omitempty"`
}

func RunBurpScript(ctx context.Context, scriptJSON string, targetURL string, orgID uint, slideID uint) error {
	var rawEvents []json.RawMessage
	if err := json.Unmarshal([]byte(scriptJSON), &rawEvents); err != nil {
		util.LogErrorf(orgID, "burp", slideID, "Failed to parse burp script: %v", err)
		return fmt.Errorf("failed to parse burp script: %v", err)
	}

	iframeMap := make(map[int]string)
	var events []BurpEvent

	for _, raw := range rawEvents {
		var top BurpTopLevelEvent
		json.Unmarshal(raw, &top)
		if top.EventType == "start" {
			for _, f := range top.Iframes {
				iframeMap[f.FrameId] = f.XPath
			}
			continue
		}

		var event BurpEvent
		json.Unmarshal(raw, &event)
		events = append(events, event)
	}

	// Initial navigation and enable target discovery
	if err := chromedp.Run(ctx,
		target.SetDiscoverTargets(true),
		chromedp.Navigate(targetURL),
	); err != nil {
		return fmt.Errorf("failed to navigate to target URL: %v", err)
	}

	for i, event := range events {
		util.LogInfof(orgID, "burp", slideID, "  [Event %d/%d] %s (Frame: %d, IsIframe: %v, XPath: %s, URL: %s)", i+1, len(events), event.EventType, event.FrameId, event.IsIframe, event.XPath, event.URL)

		var step chromedp.Action
		switch event.EventType {
		case "goto":
			step = chromedp.Navigate(event.URL)
		case "click":
			if event.XPath != "" {
				step = chromedp.Tasks{
					chromedp.WaitVisible(event.XPath, chromedp.BySearch),
					chromedp.Click(event.XPath, chromedp.BySearch),
				}
			}
		case "typing":
			if event.XPath != "" {
				step = chromedp.Tasks{
					chromedp.WaitVisible(event.XPath, chromedp.BySearch),
					chromedp.SendKeys(event.XPath, event.TypedValue, chromedp.BySearch),
				}
			}
		case "keyboard":
			if event.Key != "" {
				keyStr := event.Key
				if keyStr == "Enter" {
					keyStr = kb.Enter
				}
				step = chromedp.KeyEvent(keyStr)
			}
		case "scroll":
			step = chromedp.Evaluate(fmt.Sprintf("window.scrollTo(%d, %d)", event.ScrollX, event.ScrollY), nil)
		case "userNavigate":
			step = chromedp.Navigate(event.URL)
		}

		if step != nil {
			targetCtx := ctx

			// If event happens in an iframe, try to find the corresponding context via Target attachment
			if event.IsIframe && event.URL != "" {
				var bestID target.ID
				// Try to find the target with retries
				for retry := 0; retry < 5; retry++ {
					err := chromedp.Run(ctx, chromedp.ActionFunc(func(c context.Context) error {
						targets, err := target.GetTargets().Do(c)
						if err != nil {
							return err
						}

						cleanTargetURL := strings.TrimRight(event.URL, "/")
						for _, t := range targets {
							cleanTURL := strings.TrimRight(t.URL, "/")
							if cleanTURL == cleanTargetURL || (len(cleanTargetURL) > 10 && cleanTURL != "" && (strings.Contains(cleanTURL, cleanTargetURL) || strings.Contains(cleanTargetURL, cleanTURL))) {
								bestID = t.TargetID
								return nil
							}
						}
						return fmt.Errorf("target not found")
					}))

					if err == nil && bestID != "" {
						util.LogInfof(orgID, "burp", slideID, "    Attached to target: %s for URL %s", bestID, event.URL)
						tCtx, _ := chromedp.NewContext(ctx, chromedp.WithTargetID(bestID))
						targetCtx = tCtx
						break
					}
					time.Sleep(500 * time.Millisecond)
				}
			}

			if err := chromedp.Run(targetCtx, step, chromedp.Sleep(1*time.Second)); err != nil {
				return fmt.Errorf("event %d (%s) failed: %v", i+1, event.EventType, err)
			}
		}
	}

	util.LogInfof(orgID, "burp", slideID, "Burp script completed, returning to worker...")
	// time.Sleep(5 * time.Second) - Handled by worker RenderDelay now
	util.LogInfof(orgID, "burp", slideID, "Burp script processing finished")
	return nil
}
