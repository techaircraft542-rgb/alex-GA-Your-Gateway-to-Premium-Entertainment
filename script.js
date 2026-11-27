// Auto-translate page based on ?lang= param or visitor's browser language (Google Translate).
(function initAutoTranslate() {
  const mapBrowserLang = (raw) => {
    if (!raw || typeof raw !== "string") return "en";
    const lower = raw.trim().toLowerCase().replace(/_/g, "-");
    if (!lower) return "en";
    if (lower.startsWith("zh")) {
      return /-(tw|hk|mo|hant)/.test(lower) ? "zh-TW" : "zh-CN";
    }
    const base = lower.split("-")[0];
    const aliases = {
      he: "iw",
      nb: "no",
      nn: "no",
      fil: "tl",
    };
    return aliases[base] || base;
  };

  const params = new URLSearchParams(window.location.search);
  const queryLang = params.get("lang");
  const browserLangs =
    Array.isArray(navigator.languages) && navigator.languages.length
      ? navigator.languages
      : [navigator.language || navigator.userLanguage || "en"];

  const targetLang = mapBrowserLang(queryLang || browserLangs[0]);

  const setGoogTransCookie = (value) => {
    const expires = value ? "" : "; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = `googtrans=${value}; path=/${expires}`;
    const host = window.location.hostname;
    if (host && host.includes(".") && !/^\d+(\.\d+)+$/.test(host)) {
      document.cookie = `googtrans=${value}; path=/; domain=.${host}${expires}`;
    }
  };

  // Skip loading Google Translate for English visitors (zero overhead).
  if (!targetLang || targetLang === "en") {
    setGoogTransCookie("");
    return;
  }

  setGoogTransCookie(`/en/${targetLang}`);

  window.googleTranslateElementInit = function () {
    if (!window.google || !window.google.translate) return;
    new window.google.translate.TranslateElement(
      {
        pageLanguage: "en",
        autoDisplay: false,
      },
      "google_translate_element"
    );

    // Fallback: trigger the hidden dropdown directly if cookies are blocked.
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      const combo = document.querySelector("select.goog-te-combo");
      if (combo && combo.options && combo.options.length > 1) {
        clearInterval(timer);
        if (combo.value !== targetLang) {
          const hasOption = Array.from(combo.options).some(
            (opt) => opt.value === targetLang
          );
          if (hasOption) {
            combo.value = targetLang;
            combo.dispatchEvent(new Event("change"));
          }
        }
      } else if (attempts >= 40) {
        clearInterval(timer);
      }
    }, 100);
  };

  const gtScript = document.createElement("script");
  gtScript.src =
    "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  gtScript.async = true;
  document.head.appendChild(gtScript);
})();

// Track Join Now clicks (all CTAs share the same link and Meta Pixel).
document.addEventListener("DOMContentLoaded", () => {
  const joinButtons = document.querySelectorAll("[data-cta-btn]");

  joinButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      if (typeof window.gtag === "function") {
        window.gtag("event", "join_now_click", { destination: btn.href });
      }

      if (typeof window.fbq === "function") {
        window.fbq("track", "Lead");

        // Brief delay on normal clicks so Meta Pixel beacon finishes before leaving page.
        if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
          e.preventDefault();
          const targetUrl = btn.href;
          setTimeout(() => {
            window.location.href = targetUrl;
          }, 150);
        }
      }
    });
  });

  // Subtle scroll-in animation for feature cards.
  const cards = document.querySelectorAll(".feature-card");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = "1";
          entry.target.style.transform = "translateY(0)";
        }
      });
    },
    { threshold: 0.15 }
  );

  cards.forEach((card, i) => {
    card.style.opacity = "0";
    card.style.transform = "translateY(24px)";
    card.style.transition = `opacity 0.5s ease ${i * 0.08}s, transform 0.5s ease ${i * 0.08}s`;
    observer.observe(card);
  });

  // Resilient hero video players (handles autoplay blocks, mute toggle, buffering, viewport pause).
  const videoCards = document.querySelectorAll("[data-video-card]");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  videoCards.forEach((card) => {
    const video = card.querySelector("video");
    if (!video) return;

    const muteBtn = card.querySelector("[data-video-mute]");
    const soundLabel = card.querySelector(".sound-label");
    const soundIcon = card.querySelector(".sound-icon");
    const toggleBtn = card.querySelector("[data-video-toggle]");
    const centerPlayBtn = card.querySelector("[data-video-center-play]");
    const progressInput = card.querySelector("[data-video-progress]");
    const fullscreenBtn = card.querySelector("[data-video-fullscreen]");
    const errorBox = card.querySelector("[data-video-error]");
    const retryBtn = card.querySelector("[data-video-retry]");

    let userPaused = false;
    let isSeeking = false;
    let lastUnmuted = null;

    const syncState = () => {
      const paused = video.paused || video.ended;
      card.classList.toggle("is-paused", paused);
      if (toggleBtn) {
        toggleBtn.setAttribute("aria-label", paused ? "Play video" : "Pause video");
      }

      const unmuted = !video.muted && video.volume > 0;
      card.classList.toggle("is-unmuted", unmuted);
      if (muteBtn) {
        muteBtn.setAttribute("aria-pressed", String(unmuted));
        muteBtn.setAttribute("aria-label", unmuted ? "Mute video" : "Unmute video");
      }
      if (unmuted !== lastUnmuted) {
        if (soundIcon) soundIcon.textContent = unmuted ? "🔊" : "🔇";
        // Preserve initial text node on load so auto-translation isn't overwritten.
        if (lastUnmuted !== null && soundLabel) {
          soundLabel.textContent = unmuted ? "Sound On" : "Tap for Sound";
        }
        lastUnmuted = unmuted;
      }
    };

    const safePlay = () => {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          syncState();
        });
      }
    };

    const togglePlay = () => {
      if (video.paused || video.ended) {
        userPaused = false;
        safePlay();
      } else {
        userPaused = true;
        video.pause();
      }
    };

    const toggleMute = () => {
      const willUnmute = video.muted;
      if (willUnmute) {
        // Mute any other video card on the page so two audio tracks never clash.
        videoCards.forEach((otherCard) => {
          if (otherCard !== card) {
            const otherVideo = otherCard.querySelector("video");
            if (otherVideo && !otherVideo.muted) {
              otherVideo.muted = true;
              otherCard.classList.remove("is-unmuted");
            }
          }
        });
        video.muted = false;
        video.volume = 1;
        if (video.paused) {
          userPaused = false;
          safePlay();
        }
      } else {
        video.muted = true;
      }
      syncState();
    };

    video.addEventListener("click", togglePlay);
    if (toggleBtn) toggleBtn.addEventListener("click", togglePlay);
    if (centerPlayBtn) {
      centerPlayBtn.addEventListener("click", () => {
        userPaused = false;
        safePlay();
      });
    }
    if (muteBtn) muteBtn.addEventListener("click", toggleMute);

    video.addEventListener("play", syncState);
    video.addEventListener("pause", syncState);
    video.addEventListener("volumechange", syncState);
    video.addEventListener("loadedmetadata", syncState);

    // Buffering indicator
    video.addEventListener("waiting", () => {
      if (video.readyState < 3) card.classList.add("is-buffering");
    });
    const clearBuffering = () => card.classList.remove("is-buffering");
    video.addEventListener("playing", clearBuffering);
    video.addEventListener("canplay", clearBuffering);
    video.addEventListener("seeked", clearBuffering);
    video.addEventListener("pause", clearBuffering);

    // Progress bar sync & seek
    video.addEventListener("timeupdate", () => {
      if (isSeeking || !progressInput || !video.duration) return;
      const pct = (video.currentTime / video.duration) * 100;
      progressInput.value = pct;
      progressInput.style.setProperty("--progress", `${pct}%`);
    });

    if (progressInput) {
      progressInput.addEventListener("input", () => {
        isSeeking = true;
        const pct = Number(progressInput.value);
        progressInput.style.setProperty("--progress", `${pct}%`);
        if (video.duration) {
          video.currentTime = (pct / 100) * video.duration;
        }
      });
      progressInput.addEventListener("change", () => {
        isSeeking = false;
      });
    }

    // Fullscreen (including iOS Safari webkitEnterFullscreen fallback)
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener("click", () => {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else if (card.requestFullscreen) {
          card.requestFullscreen().catch(() => {
            if (typeof video.webkitEnterFullscreen === "function") {
              video.webkitEnterFullscreen();
            }
          });
        } else if (typeof video.webkitEnterFullscreen === "function") {
          video.webkitEnterFullscreen();
        }
      });
    }

    // Error & retry handling
    const showError = () => {
      clearBuffering();
      card.classList.add("has-error");
      if (errorBox) errorBox.hidden = false;
    };

    const sourceEl = video.querySelector("source");
    video.addEventListener("error", showError);
    if (sourceEl) sourceEl.addEventListener("error", showError);

    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        card.classList.remove("has-error");
        if (errorBox) errorBox.hidden = true;
        video.load();
        userPaused = false;
        safePlay();
      });
    }

    // Pause automatically when scrolled out of view to save battery & bandwidth.
    if ("IntersectionObserver" in window) {
      const videoObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              if (!userPaused && !prefersReducedMotion && video.paused) {
                safePlay();
              }
            } else if (!video.paused) {
              video.pause();
            }
          });
        },
        { threshold: 0.2 }
      );
      videoObserver.observe(card);
    }

    if (prefersReducedMotion) {
      video.pause();
    } else {
      safePlay();
    }
    syncState();
  });
});
