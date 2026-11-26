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
      if (soundIcon) soundIcon.textContent = unmuted ? "🔊" : "🔇";
      if (soundLabel) soundLabel.textContent = unmuted ? "Sound On" : "Tap for Sound";
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
