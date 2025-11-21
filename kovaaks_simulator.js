(function() {

    // Wait for SOUND to be available
    const initScript = () => {
        if (!window.SOUND || !window.SOUND.play) {
            setTimeout(initScript, 100);
            return;
        }

        console.log("[LombreScripts] [Kovaaks_Simulator.js] === AUDIO SCRIPT INITIALIZATION ===");
        firstStart = false

        // ==========================================
        // CONFIGURATION & DEFAULTS
        // ==========================================

        const defaults = {
            // Kovaaks Simulator settings
            lombre_kovaaks_simulator_reset_delay: 500,
            lombre_kovaaks_simulator_pitch_increment: 0.5,
            lombre_kovaaks_simulator_max_pitch: 10,
            lombre_kovaaks_simulator_hitmarker_sounds: '["hit_0", "crit_0", "crit_1"]',

            // Kill sound settings
            lombre_kovaaks_simulator_kill_sound_sound_link: "https://files.catbox.moe/6w5695.mp3",
            lombre_kovaaks_simulator_kill_sound_you_text_color: '["rgb(255, 255, 255)", "#fff"]',
            lombre_kovaaks_simulator_kill_sound_you_text_username: "You"
        };

        // Initialize localStorage if values don't exist
        Object.keys(defaults).forEach(key => {
            if (localStorage.getItem(key) === null) {
                firstStart = true
                localStorage.setItem(key, defaults[key]);
                console.log(`[LombreScripts] [Kovaaks_Simulator.js] ${key} created with default value: ${defaults[key]}`);
            }
        });
        if (firstStart) alert("Since its ur first time with kovaaks_simulator.js, the default mod to use is 'LombreKovaaksSim'")

        // Load configuration
        const config = {
            RESET_DELAY: parseInt(localStorage.getItem('lombre_kovaaks_simulator_reset_delay')),
            PITCH_INCREMENT: parseFloat(localStorage.getItem('lombre_kovaaks_simulator_pitch_increment')),
            MAX_PITCH: parseFloat(localStorage.getItem('lombre_kovaaks_simulator_max_pitch')),
            HITMARKER_SOUNDS: JSON.parse(localStorage.getItem('lombre_kovaaks_simulator_hitmarker_sounds')),

            KILL_SOUND_LINK: localStorage.getItem('lombre_kovaaks_simulator_kill_sound_sound_link'),
            YOU_COLOR: JSON.parse(localStorage.getItem('lombre_kovaaks_simulator_kill_sound_you_text_color')),
            YOU_USERNAME: localStorage.getItem("lombre_kovaaks_simulator_kill_sound_you_text_username")
        };

        console.log("[LombreScripts] [Kovaaks_Simulator.js] Configuration loaded:", config);

        // ==========================================
        // PART 1: MUTE LOCAL SHOTS (volume = 0.85)
        // ==========================================

        let hitCount = 0;
        let resetTimer = null;

        // Hook AudioBufferSourceNode to modify playbackRate
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            const ctx = new AudioContext();
            const SourceNode = ctx.createBufferSource().constructor;
            const originalStart = SourceNode.prototype.start;

            SourceNode.prototype.start = function(...args) {
                if (window._nextHitPitch) {
                    this.playbackRate.value = window._nextHitPitch;
                    console.log(`[LombreScripts] [Kovaaks_Simulator.js] Pitch applied: ${window._nextHitPitch.toFixed(2)}x`);
                    window._nextHitPitch = null;
                }
                return originalStart.apply(this, args);
            };
            console.log("[LombreScripts] [Kovaaks_Simulator.js] AudioBufferSourceNode hook enabled");
        }

        // ==========================================
        // MAIN HOOK: window.SOUND.play
        // ==========================================
        const originalPlay = window.SOUND.play;

        window.SOUND.play = function(soundName, volume, loop) {

            // --- MUTE HEADSHOT_0 ---
            if (soundName === 'headshot_0') {
                console.log(`[LombreScripts] [Kovaaks_Simulator.js] Headshot sound blocked: ${soundName}`);
                return; // Don't play the sound
            }

            // --- MUTE LOCAL SHOTS ---
            if (soundName.startsWith('weapon_') && volume === 0.85) {
                console.log(`[LombreScripts] [Kovaaks_Simulator.js] Local shot blocked: ${soundName} (vol: ${volume})`);
                return; // Don't play the sound
            }

            // --- PROGRESSIVE PITCH HITMARKERS ---
            if (config.HITMARKER_SOUNDS.includes(soundName)) {
                if (resetTimer) clearTimeout(resetTimer);

                hitCount++;
                const pitchRate = Math.min(1 + (hitCount - 1) * config.PITCH_INCREMENT, config.MAX_PITCH);

                console.log(`[LombreScripts] [Kovaaks_Simulator.js] HIT #${hitCount} (${soundName}) - Pitch: ${pitchRate.toFixed(2)}x`);

                window._nextHitPitch = pitchRate;

                resetTimer = setTimeout(() => {
                    hitCount = 0;
                    console.log("[LombreScripts] [Kovaaks_Simulator.js] Hitmarker counter reset");
                }, config.RESET_DELAY);
            }

            // Original call for all other sounds
            return originalPlay.call(this, soundName, volume, loop);
        };

        console.log("[LombreScripts] [Kovaaks_Simulator.js] Local shots (vol=0.85) disabled");
        console.log("[LombreScripts] [Kovaaks_Simulator.js] Progressive pitch enabled for:", config.HITMARKER_SOUNDS.join(", "));

        // ==========================================
        // PART 3: KILL SOUND ON CHAT DETECTION
        // ==========================================

        // Preload the audio as soon as the script loads
        const audioPreloaded = new Audio(config.KILL_SOUND_LINK);
        audioPreloaded.preload = "auto";
        audioPreloaded.load();
        console.log("[LombreScripts] [Kovaaks_Simulator.js] Kill sound preloaded:", config.KILL_SOUND_LINK);

        function playKillSound() {
            // Clone the preloaded audio to allow multiple rapid plays
            const audio = audioPreloaded.cloneNode();
            audio.play().catch(err => console.error("[LombreScripts] [Kovaaks_Simulator.js] Audio playback error:", err));
            console.log(`[LombreScripts] [Kovaaks_Simulator.js] Kill sound played`);
        }

        function observeChat() {
            const chatContainer = document.querySelector("#chatList");

            if (!chatContainer) {
                console.log("[LombreScripts] [Kovaaks_Simulator.js] Chat container not found, retrying in 1s...");
                setTimeout(observeChat, 1000);
                return;
            }

            const mutationWatcher = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === "childList") {
                        mutation.addedNodes.forEach((newNode) => {
                            if (newNode.nodeType === 1 && newNode.tagName === "DIV") {
                                const messageSpan = newNode.querySelector("span.chatMsg");
                                if (messageSpan) {
                                    const coloredSpans = messageSpan.querySelectorAll("span[style*='color:#'], span[style*='color: rgb']");

                                    if (coloredSpans.length > 0) {
                                        const firstColoredSpan = coloredSpans[0];
                                        const spanColor = firstColoredSpan.style.color.trim().toLowerCase();
                                        const spanText = firstColoredSpan.textContent.trim();

                                        console.log(`[LombreScripts] [Kovaaks_Simulator.js] Checking: "${spanText}" with color "${spanColor}"`);

                                        if (config.YOU_COLOR.includes(spanColor) && spanText === config.YOU_USERNAME) {
                                            console.log("[LombreScripts] [Kovaaks_Simulator.js] Kill detected!");
                                            playKillSound();
                                        }
                                    }
                                }
                            }
                        });
                    }
                });
            });

            mutationWatcher.observe(chatContainer, {
                childList: true
            });

            console.log("[LombreScripts] [Kovaaks_Simulator.js] Chat observer initialized");
        }

        // Start observing chat after a delay
        setTimeout(() => {
            observeChat();
        }, 3000);

        console.log("[LombreScripts] [Kovaaks_Simulator.js] === AUDIO SCRIPT READY ===");
    };

    // Start initialization
    initScript();
})();
