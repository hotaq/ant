/**
 * ============================================================================
 * FULL-SCREEN SINGLE ANT SIMULATION — CONFIG DRIVEN RETRO PIXEL ENGINE
 * ============================================================================
 */

// ⚙️ GLOBAL GAME & SPRITE CONFIGURATION
const CONFIG = {
    // 🌍 Virtual World Dimensions
    world: {
        width: 3200,
        height: 2000
    },

    // 🖼️ Ant walk animation frames (relative paths from index.html)
    antFramePaths: [
        'assest/ant/mixboard-image-removebg-preview.png',   // Index 0
        'assest/ant/mixboard-image__1_-removebg-preview.png', // Index 1
        'assest/ant/mixboard-image__2_-removebg-preview.png', // Index 2
        'assest/ant/mixboard-image__3_-removebg-preview.png'  // Index 3
    ],
    
    // 🐜 Ant gameplay and physical properties
    ant: {
        size: 0.5,                   // Size scale (smaller, highly detailed micro ant!)
        speed: 100,                  // Movement speed (pixels per second)
        animationSpeedFactor: 0.06,  // Walk animation frame rate (lower = slower legs, higher = faster legs)
        angularSpeed: 6.0,           // Steering rotation speed (how fast the ant turns towards targets)
        maxCount: 40,                // Keep simulation cost bounded during repeated spawn clicks
        spawnCooldownMs: 150,        // Prevent accidental click bursts from creating too many ants at once
        spawnMargin: 80,             // Preferred random spawn inset from screen edges
        
        // 🔄 Walk frame order sequence. 
        animationPattern: [0, 1, 3, 2]
    },

    effects: {
        maxParticles: 700,           // Shared dust-particle budget across all ants
        maxTrails: 1400              // Shared footprint/highway budget across all ants
    },

    // 🌿 Interactive Grass & Wind Settings
    grass: {
        count: 240,                  // Thick, lush density across the massive world!
        baseSize: 0.75,              // Scale factor of the grass (smaller, highly detailed retro grass!)
        rustleDistance: 22,          // Snappy rustling distance adapted for smaller sizes
        animationSpeed: 14,          // Speed of the rustle vibration oscillation
        
        // 💨 Global Wind Settings
        windSpeed: 2.2,              // Speed of the wind breeze oscillation (lower = slower/calmer)
        windStrength: 0.08,          // Maximum sway angle in radians (gentle tilt, ~4.5 degrees)
        windWaveScale: 0.006         // Rolling wave spatial offset (creates left-to-right blowing flow)
    },

    // 🌸 Scattered Flower Settings
    flowers: {
        count: 45,                   // Rich wildflower meadows scattered across the sandbox!
        baseSize: 0.18,              // Scale factor for flower images (perfectly sized wildflowers!)
        swayStrength: 0.045,         // Gentle flower wind sway angle
        rustleDistance: 16,          // Snappy rustling distance for flowers (smaller threshold than grass!)
        animationSpeed: 18,          // Fast, springy vibration frequency for flowers
        paths: [
            'assest/grass/flower/Screenshot_2569-05-23_at_15.41.52-removebg-preview.png',
            'assest/grass/flower/Screenshot_2569-05-23_at_15.41.56-removebg-preview.png',
            'assest/grass/flower/Screenshot_2569-05-23_at_15.42.00-removebg-preview.png',
            'assest/grass/flower/Screenshot_2569-05-23_at_15.42.04-removebg-preview.png'
        ]
    },

    // 🪨 Interactive Scattered Stone Settings
    stones: {
        count: 35,                   // Number of obstacle stones scattered across the world
        baseSize: 1.0,               // Base scale factor of procedural stones
        avoidRadiusFactor: 1.8,      // Distance at which ants steer away from stones (1.8x stone radius)
        colors: [
            '#7f8c8d',               // Slate Grey
            '#95a5a6',               // Concrete Grey
            '#5d6d7e',               // Steel Grey
            '#34495e'                // Charcoal Grey
        ]
    },

    // 🌊 Interactive Lake & Water Settings
    lake: {
        lakes: [
            { x: 800, y: 1200, rx: 360, ry: 240 },  // Giant central-left lake
            { x: 2400, y: 550, rx: 240, ry: 170 }   // Scenic top-right pond
        ],
        avoidRadiusBuffer: 30,                     // Distance margin for shoreline avoidance steering
        colors: {
            deep: '#1b4f72',                       // Deep water navy
            mid: '#2e86c1',                        // Shimmering base blue water
            highlight: '#5dade2',                  // Ripple glisten highlight
            sand: '#e5c185',                       // Sandy beach yellow
            sandShadow: '#c8a66b'                  // Sandy damp transition border
        }
    }
};

class GameSimulation {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.ants = [];
        this.markers = [];
        this.particles = []; // 💨 Retro pixel dust particles
        this.grassTufts = []; // 🌿 Interactive grass clumps
        this.flowerList = []; // 🌸 Scattered flowers positions
        this.stoneList = [];  // 🪨 Procedurally generated obstacle stones
        
        // 🏡 Formigueiro (Anthill) State
        this.nestPos = null;
        this.nestPlaced = false;
        this.placementMode = null; // Can be 'nest' when placing Formigueiro
        this.nestPixels = [];      // Chunky pixels of the Formigueiro
        this.nestRadius = 0;       // Visual and physical radius
        
        // 🌊 Water Ripples Shimmer list
        this.waterRipples = [];
        
        this.windGusts = [];  // 💨 Visual pixel wind smoke trails
        this.windGustTimer = 0.5; // Spawn first wind gust quickly
        this.troddenTrails = []; // 👣 Dynamic decaying footprint & highway trails (3s fade!)
        
        this.lastTime = 0;
        this.windTime = 0; // 💨 Global wind phase timer
        this.bgCanvas = null; // Offscreen canvas for high-performance pixel background
        this.lastManualSpawnAt = 0;

        // 🎥 Smooth Camera Pan & Zoom Engine State
        this.cameraX = CONFIG.world.width / 2; // Center camera in virtual world space at startup
        this.cameraY = CONFIG.world.height / 2;
        this.cameraZoom = 0.7; // Start slightly zoomed out to showcase the massive landscape
        this.targetZoom = 0.7;
        this.zoomLerpSpeed = 0.08; // Smooth, premium kinetic zooming feeling
        
        // Panning drag states
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.draggedDistance = 0;
        
        // Track screenspace mouse position for cursor-centric zoom centering
        this.mouseX = window.innerWidth / 2;
        this.mouseY = window.innerHeight / 2;

        // Dynamic preloader for Ant walk frames (Grass is drawn procedurally!)
        this.antFrames = [];
        this.antFramesLoaded = 0;
        this.loadAntFrames();

        // Preload Flower assets
        this.flowerFrames = [];
        this.flowerFramesLoaded = 0;
        this.loadFlowerFrames();
        
        this.init();
    }

    loadAntFrames() {
        if (!CONFIG.antFramePaths || CONFIG.antFramePaths.length === 0) {
            console.warn("No ant frame paths specified in CONFIG.");
            return;
        }

        CONFIG.antFramePaths.forEach((path, idx) => {
            const img = new Image();
            img.src = path;
            img.onload = () => {
                this.antFramesLoaded++;
                console.log(`Loaded ant frame ${idx + 1}/${CONFIG.antFramePaths.length}: ${path}`);
            };
            img.onerror = () => {
                console.warn(`Could not load ant image at: ${path}. Falling back to procedural rendering.`);
            };
            this.antFrames.push(img);
        });
    }

    loadFlowerFrames() {
        if (!CONFIG.flowers || !CONFIG.flowers.paths) return;
        
        CONFIG.flowers.paths.forEach((path, idx) => {
            const img = new Image();
            img.src = path;
            img.onload = () => {
                this.flowerFramesLoaded++;
                console.log(`Loaded flower frame ${idx + 1}/${CONFIG.flowers.paths.length}: ${path}`);
            };
            img.onerror = () => {
                console.warn(`Could not load flower image at: ${path}`);
            };
            this.flowerFrames.push(img);
        });
    }

    generateLakePositions() {
        const w = CONFIG.world.width;
        const h = CONFIG.world.height;
        
        // Randomize lake count: 1 or 2 lakes (max 2 lakes)
        const numLakes = Math.random() < 0.25 ? 1 : 2; // 75% chance of 2 lakes, 25% chance of 1 lake
        
        const newLakes = [];
        
        // Lake 1: Randomized Large Lake in Left/Center region
        const rx1 = 280 + Math.random() * 140; // Size variation: 280px to 420px
        const ry1 = 180 + Math.random() * 100; // Size variation: 180px to 280px
        const x1 = rx1 + 150 + Math.random() * (w / 2 - rx1 - 300);
        const y1 = ry1 + 150 + Math.random() * (h - ry1 * 2 - 300);
        
        newLakes.push({
            x: Math.round(x1),
            y: Math.round(y1),
            rx: Math.round(rx1),
            ry: Math.round(ry1),
            // Unique shape parameters for procedural wave-deformation
            waveIntensity: 0.05 + Math.random() * 0.08, // Wobble intensity: 5% to 13%
            freq1: 4.0 + Math.random() * 6.0,          // Sin frequency coefficient
            freq2: 2.0 + Math.random() * 4.0           // Cos frequency coefficient
        });
        
        if (numLakes === 2) {
            // Lake 2: Randomized Small Lake in Right/Center region
            const rx2 = 160 + Math.random() * 90;  // Size variation: 160px to 250px
            const ry2 = 110 + Math.random() * 70;  // Size variation: 110px to 180px
            const x2 = w / 2 + rx2 + 150 + Math.random() * (w / 2 - rx2 - 300);
            const y2 = ry2 + 150 + Math.random() * (h - ry2 * 2 - 300);
            
            newLakes.push({
                x: Math.round(x2),
                y: Math.round(y2),
                rx: Math.round(rx2),
                ry: Math.round(ry2),
                // Unique shape parameters for procedural wave-deformation
                waveIntensity: 0.04 + Math.random() * 0.06, // Wobble intensity: 4% to 10%
                freq1: 3.5 + Math.random() * 5.0,          // Sin frequency coefficient
                freq2: 1.5 + Math.random() * 3.5           // Cos frequency coefficient
            });
        }
        
        CONFIG.lake.lakes = newLakes;
    }

    saveWorldToLocalStorage() {
        const mapState = {
            lakes: CONFIG.lake.lakes,
            stones: this.stoneList.map(s => ({ x: s.x, y: s.y, scale: s.scale, colorIdx: s.colorIdx })),
            grass: this.grassTufts.map(g => ({ x: g.x, y: g.y, size: g.size })),
            flowers: this.flowerList.map(f => ({ x: f.x, y: f.y, imgIndex: f.imgIndex, scale: f.scale })),
            nestPos: this.nestPos,
            nestPlaced: this.nestPlaced
        };
        try {
            localStorage.setItem('ant_kingdom_save_state', JSON.stringify(mapState));
        } catch (e) {
            console.warn("Could not save map state to localStorage:", e);
        }
    }

    loadWorldFromLocalStorage() {
        const saved = localStorage.getItem('ant_kingdom_save_state');
        if (!saved) return false;
        
        try {
            const mapState = JSON.parse(saved);
            if (!mapState || !mapState.lakes) return false;
            
            // Restore Lakes
            CONFIG.lake.lakes = mapState.lakes;
            
            // Restore Stones and regenerate pixels
            this.stoneList = [];
            for (const s of mapState.stones) {
                const { pixels, width, height, radius } = this.generateStonePixels(s.scale);
                this.stoneList.push({
                    x: s.x,
                    y: s.y,
                    scale: s.scale,
                    pixels: pixels,
                    width: width,
                    height: height,
                    radius: radius,
                    colorIdx: s.colorIdx !== undefined ? s.colorIdx : 0
                });
            }
            this.stoneList.sort((a, b) => a.y - b.y);
            
            // Restore Grass and regenerate pixels
            this.grassTufts = [];
            for (const g of mapState.grass) {
                const { pixels, maxHeight } = this.generateGrassClumpPixels(g.size);
                this.grassTufts.push({
                    x: g.x,
                    y: g.y,
                    size: g.size,
                    pixels: pixels,
                    maxHeight: maxHeight,
                    rustlePhase: 0,
                    rustleSpeed: 0,
                    isRustling: false
                });
            }
            
            // Restore Flowers
            this.flowerList = [];
            for (const f of mapState.flowers) {
                this.flowerList.push({
                    x: f.x,
                    y: f.y,
                    imgIndex: f.imgIndex,
                    scale: f.scale,
                    rustlePhase: 0,
                    rustleSpeed: 0,
                    isRustling: false
                });
            }
            
            // Restore Nest
            this.nestPos = mapState.nestPos;
            this.nestPlaced = mapState.nestPlaced;
            if (this.nestPlaced && this.nestPos) {
                this.generateNestPixels();
                // Toggle UI buttons on load!
                const placeBtn = document.getElementById('btn-place-nest');
                if (placeBtn) placeBtn.style.display = 'none';
                const spawnBtn = document.getElementById('btn-spawn-ant');
                if (spawnBtn) spawnBtn.style.display = 'block';
                
                // Spawn 3 initial ants emerging from the nest as a delightful load reward!
                for (let k = 0; k < 3; k++) {
                    setTimeout(() => {
                        this.spawnAnt(this.nestPos.x, this.nestPos.y);
                    }, k * 180);
                }
            }
            
            return true;
        } catch (e) {
            console.warn("Failed to load map state from localStorage:", e);
            return false;
        }
    }

    generateNewWorld() {
        // Clear gameplay states
        this.nestPos = null;
        this.nestPlaced = false;
        this.ants = [];
        this.markers = [];
        this.troddenTrails = [];
        
        // Generate new randomized terrain coordinates
        this.generateLakePositions();
        this.generateStones(); // Generate stones first so grass/flowers can avoid them!
        this.generateGrass();
        this.generateFlowers();
        
        // Render background canvas from the new coordinates
        this.generatePixelBackground();
        
        // Persist the new world state to localStorage
        this.saveWorldToLocalStorage();
    }

    init() {
        this.resizeCanvas();
        
        // Try to load preserved world, otherwise generate procedurally
        const loaded = this.loadWorldFromLocalStorage();
        if (!loaded) {
            this.generateNewWorld();
        } else {
            // Re-pre-render background canvas from restored coordinates
            this.generatePixelBackground();
        }
        
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // 🎮 --- MOUSE & TRACKPAD GESTURE ENGINE (Cross-Platform Pan & Zoom) ---
        
        // Track screenspace mouse position on any mouse move
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
            
            if (this.isDragging) {
                const dx = e.clientX - this.dragStartX;
                const dy = e.clientY - this.dragStartY;
                
                this.dragStartX = e.clientX;
                this.dragStartY = e.clientY;
                
                this.draggedDistance += Math.hypot(dx, dy);
                
                // Shift camera in opposite direction scaled by current zoom level (1:1 dragging!)
                this.cameraX -= dx / this.cameraZoom;
                this.cameraY -= dy / this.cameraZoom;
                
                this.clampCamera();
            }
        });
        
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left-click drag panning
                this.isDragging = true;
                this.dragStartX = e.clientX;
                this.dragStartY = e.clientY;
                this.draggedDistance = 0;
                
                // Dynamic premium cursor feedback!
                this.canvas.style.cursor = 'grabbing';
            }
        });
        
        this.canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0 && this.isDragging) {
                this.isDragging = false;
                this.canvas.style.cursor = 'crosshair';
                
                // Click conflict resolution: displacement < 5px triggers target pheromone drop
                if (this.draggedDistance < 5) {
                    this.handleCanvasClick(e);
                }
            }
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
            this.canvas.style.cursor = 'crosshair';
        });
        
        // Normalized wheel scroll zoom for Windows (wheel ticks) and macOS (trackpad pinch/scroll)
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
            
            let factor;
            if (e.ctrlKey) {
                // Pinch zoom gesture (macOS trackpad) - smooth sub-pixel factors
                factor = 1 - e.deltaY * 0.012;
            } else {
                // Standard scroll wheel tick - standard 8% ratio direction
                factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
            }
            
            this.targetZoom = Math.max(0.4, Math.min(3.0, this.targetZoom * factor));
        }, { passive: false });
        
        // 📱 --- MOBILE GESTURE ENGINE (Touch Panning & Multi-Touch Pinch Zooming) ---
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.initialTouchDist = 0;
        this.initialZoom = 1.0;
        
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                this.isDragging = true;
                this.dragStartX = e.touches[0].clientX;
                this.dragStartY = e.touches[0].clientY;
                this.draggedDistance = 0;
            } else if (e.touches.length === 2) {
                this.isDragging = false;
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                this.initialTouchDist = Math.hypot(dx, dy);
                this.initialZoom = this.targetZoom;
                
                const rect = this.canvas.getBoundingClientRect();
                this.mouseX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
                this.mouseY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
            }
        }, { passive: true });
        
        this.canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1 && this.isDragging) {
                const dx = e.touches[0].clientX - this.dragStartX;
                const dy = e.touches[0].clientY - this.dragStartY;
                
                this.dragStartX = e.touches[0].clientX;
                this.dragStartY = e.touches[0].clientY;
                
                this.draggedDistance += Math.hypot(dx, dy);
                
                this.cameraX -= dx / this.cameraZoom;
                this.cameraY -= dy / this.cameraZoom;
                this.clampCamera();
            } else if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.hypot(dx, dy);
                
                if (this.initialTouchDist > 0) {
                    const factor = dist / this.initialTouchDist;
                    this.targetZoom = Math.max(0.4, Math.min(3.0, this.initialZoom * factor));
                }
            }
        }, { passive: true });
        
        this.canvas.addEventListener('touchend', (e) => {
            if (this.isDragging) {
                this.isDragging = false;
                if (this.draggedDistance < 5) {
                    const rect = this.canvas.getBoundingClientRect();
                    const tx = e.changedTouches[0].clientX - rect.left;
                    const ty = e.changedTouches[0].clientY - rect.top;
                    const worldPos = this.screenToWorld(tx, ty);
                    
                    if (this.placementMode === 'nest') {
                        // 🌊 Nest placement water boundary check!
                        if (this.isInsideLake(worldPos.x, worldPos.y)) {
                            this.showToast("CANNOT BUILD HOME IN WATER!");
                            return;
                        }

                        this.nestPos = { x: worldPos.x, y: worldPos.y };
                        this.generateNestPixels();
                        this.nestPlaced = true;
                        this.placementMode = null;
                        
                        const placeBtn = document.getElementById('btn-place-nest');
                        if (placeBtn) placeBtn.style.display = 'none';
                        const spawnBtn = document.getElementById('btn-spawn-ant');
                        if (spawnBtn) spawnBtn.style.display = 'block';
                        
                        this.canvas.style.cursor = 'crosshair';
                        
                        // Persist nest placement in local storage!
                        this.saveWorldToLocalStorage();

                        // Spawn 3 initial ants emerging from the nest as a delightful reward!
                        for (let k = 0; k < 3; k++) {
                            setTimeout(() => {
                                this.spawnAnt(this.nestPos.x, this.nestPos.y);
                            }, k * 180);
                        }
                    } else {
                        this.markers.push({
                            x: worldPos.x,
                            y: worldPos.y,
                            radius: 8,
                            pulsePhase: 0,
                            pulseSpeed: 0.1,
                            intensity: 1.0
                        });
                    }
                }
            }
            this.initialTouchDist = 0;
        }, { passive: true });
        
        // Bind PLACE NEST button with click propagation stopped
        const placeNestBtn = document.getElementById('btn-place-nest');
        if (placeNestBtn) {
            placeNestBtn.addEventListener('mousedown', (e) => {
                e.stopPropagation(); // Prevents placing marker under the button on press
            });
            placeNestBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevents placing marker under the button on click
                
                // Toggle placement mode
                if (this.placementMode === 'nest') {
                    this.placementMode = null;
                    placeNestBtn.style.backgroundColor = '#d35400'; // Reset retro orange color
                    this.canvas.style.cursor = 'crosshair';
                } else {
                    this.placementMode = 'nest';
                    placeNestBtn.style.backgroundColor = '#8e44ad'; // Purple highlight for active mode!
                    this.canvas.style.cursor = 'cell'; // Crosshair box cursor
                }
            });
        }
        
        // Bind floating retro spawn button with click propagation stopped
        const spawnBtn = document.getElementById('btn-spawn-ant');
        if (spawnBtn) {
            spawnBtn.addEventListener('mousedown', (e) => {
                e.stopPropagation(); // Prevents placing marker under the button on press
            });
            spawnBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevents placing marker under the button on click

                const now = performance.now();
                if (now - this.lastManualSpawnAt < CONFIG.ant.spawnCooldownMs) {
                    return;
                }

                // Emerges directly from the Formigueiro center!
                if (this.nestPlaced && this.nestPos) {
                    if (this.spawnAnt(this.nestPos.x, this.nestPos.y)) {
                        this.lastManualSpawnAt = now;
                    }
                }
            });
        }
        
        // Bind SETTINGS button, CLOSE button, and Settings Modal
        const settingsBtn = document.getElementById('btn-settings');
        const modal = document.getElementById('settings-modal');
        const closeBtn = document.querySelector('.pixel-modal-close');
        
        if (settingsBtn && modal) {
            settingsBtn.addEventListener('mousedown', (e) => {
                e.stopPropagation(); // Prevents placing marker under the button on press
            });
            settingsBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevents placing marker under the button on click
                modal.style.display = 'flex';
            });
        }
        
        if (closeBtn && modal) {
            closeBtn.addEventListener('mousedown', (e) => {
                e.stopPropagation(); // Prevents placing marker under the button on press
            });
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevents placing marker under the button on click
                modal.style.display = 'none';
            });
            
            // Close modal when clicking outside of the content block
            modal.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });
            modal.addEventListener('click', (e) => {
                e.stopPropagation();
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }
        
        // Bind RECREATE WORLD button with click propagation stopped
        const recreateBtn = document.getElementById('btn-recreate-world');
        if (recreateBtn) {
            recreateBtn.addEventListener('mousedown', (e) => {
                e.stopPropagation(); // Prevents placing marker under the button on press
            });
            recreateBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevents placing marker under the button on click
                
                // Clear active save state
                localStorage.removeItem('ant_kingdom_save_state');
                
                // Toggle UI buttons back to startup placement state
                const placeBtn = document.getElementById('btn-place-nest');
                if (placeBtn) {
                    placeBtn.style.display = 'block';
                    placeBtn.style.backgroundColor = '#d35400'; // Reset color
                }
                const spawnBtn = document.getElementById('btn-spawn-ant');
                if (spawnBtn) spawnBtn.style.display = 'none';
                
                this.placementMode = null;
                this.canvas.style.cursor = 'crosshair';
                
                // Hide settings modal
                if (modal) {
                    modal.style.display = 'none';
                }
                
                // Generate a fresh procedural world and save it immediately
                this.generateNewWorld();
                
                // Show gorgeous warning toast
                this.showToast("WORLD RECREATED!");
            });
        }
        
        // Start game loop
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (this.cameraX !== undefined) {
            this.clampCamera();
        }
    }

    // 🖥️ ↔️ 🌍 Coordinate Conversion Helpers
    screenToWorld(sx, sy) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const wx = this.cameraX + (sx - w / 2) / this.cameraZoom;
        const wy = this.cameraY + (sy - h / 2) / this.cameraZoom;
        return { x: wx, y: wy };
    }

    worldToScreen(wx, wy) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const sx = w / 2 + (wx - this.cameraX) * this.cameraZoom;
        const sy = h / 2 + (wy - this.cameraY) * this.cameraZoom;
        return { x: sx, y: sy };
    }

    // 🎥 Clamping camera viewport to remain strictly within the 3200x2000 virtual borders
    clampCamera() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        // Visible worldspace viewport width/height
        const viewW = w / this.cameraZoom;
        const viewH = h / this.cameraZoom;
        
        const worldW = CONFIG.world.width;
        const worldH = CONFIG.world.height;
        
        // Clamp X camera center
        if (viewW >= worldW) {
            this.cameraX = worldW / 2; // Keep centered when zoomed out further than the world width
        } else {
            const minX = viewW / 2;
            const maxX = worldW - viewW / 2;
            this.cameraX = Math.max(minX, Math.min(maxX, this.cameraX));
        }
        
        // Clamp Y camera center
        if (viewH >= worldH) {
            this.cameraY = worldH / 2; // Keep centered when zoomed out further than the world height
        } else {
            const minY = viewH / 2;
            const maxY = worldH - viewH / 2;
            this.cameraY = Math.max(minY, Math.min(maxY, this.cameraY));
        }
    }

    // 🌊 boundary check for a specific procedural lake l
    isInsideLakeOf(wx, wy, l) {
        const dx = wx - l.x;
        const dy = wy - l.y;
        const dist = Math.hypot(dx, dy);
        if (dist === 0) return true;
        
        const angle = Math.atan2(dy, dx);
        // Dynamic perimeter deformation wave using per-lake randomized shape coefficients
        const waveIntensity = l.waveIntensity !== undefined ? l.waveIntensity : 0.08;
        const freq1 = l.freq1 !== undefined ? l.freq1 : 6.5;
        const freq2 = l.freq2 !== undefined ? l.freq2 : 3.0;
        const wave = 1.0 + waveIntensity * Math.sin(angle * freq1) * Math.cos(angle * freq2);
        
        const rx = l.rx * wave;
        const ry = l.ry * wave;
        
        return (Math.pow(dx / rx, 2) + Math.pow(dy / ry, 2)) <= 1.0;
    }

    // 🌊 boundary check for all active procedural lakes
    isInsideLake(wx, wy) {
        if (!CONFIG.lake || !CONFIG.lake.lakes) return false;
        
        for (const l of CONFIG.lake.lakes) {
            if (this.isInsideLakeOf(wx, wy, l)) {
                return true;
            }
        }
        return false;
    }

    randomWorldPoint(margin) {
        return {
            x: this.randomAxisPoint(CONFIG.world.width, margin),
            y: this.randomAxisPoint(CONFIG.world.height, margin)
        };
    }

    randomAxisPoint(length, margin) {
        if (length <= 0) return 0;

        const safeMargin = Math.min(Math.max(0, margin), length / 2);
        const span = Math.max(0, length - safeMargin * 2);
        return safeMargin + Math.random() * span;
    }

    clampAxisPoint(value, length, margin) {
        if (length <= 0) return 0;

        const safeMargin = Math.min(Math.max(0, margin), length / 2);
        const min = safeMargin;
        const max = Math.max(min, length - safeMargin);
        return Math.max(min, Math.min(max, value));
    }

    // 🌸 Generate randomized flower positions scattered across the full virtual world boundaries
    generateFlowers() {
        this.flowerList = [];
        if (!CONFIG.flowers || !CONFIG.flowers.paths) return;
        
        const margin = 80;
        const w = CONFIG.world.width;
        const h = CONFIG.world.height;
        
        for (let i = 0; i < CONFIG.flowers.count; i++) {
            const imgIndex = Math.floor(Math.random() * CONFIG.flowers.paths.length);
            
            let fx, fy;
            let attempts = 0;
            let overlapsStone = false;
            let overlapsWater = false;
            
            do {
                fx = this.randomAxisPoint(w, margin);
                fy = this.randomAxisPoint(h, margin);
                
                overlapsStone = false;
                for (const stone of this.stoneList) {
                    const dist = Math.hypot(fx - stone.x, fy - stone.y);
                    if (dist < stone.radius * 1.5) {
                        overlapsStone = true;
                        break;
                    }
                }
                
                // Also check if overlaps water or sandy beach transition zone
                overlapsWater = this.isInsideLake(fx, fy) || 
                                this.isInsideLake(fx + 25, fy) || 
                                this.isInsideLake(fx - 25, fy) || 
                                this.isInsideLake(fx, fy + 25) || 
                                this.isInsideLake(fx, fy - 25);
                
                attempts++;
            } while ((overlapsStone || overlapsWater) && attempts < 25);
            
            this.flowerList.push({
                x: fx,
                y: fy,
                imgIndex: imgIndex,
                scale: CONFIG.flowers.baseSize * (0.85 + Math.random() * 0.3),
                rustlePhase: 0,
                rustleSpeed: 0,
                isRustling: false
            });
        }
    }

    // 🪨 Generate randomized stones scattered across the full virtual world boundaries
    generateStones() {
        this.stoneList = [];
        const margin = 100;
        const w = CONFIG.world.width;
        const h = CONFIG.world.height;
        
        for (let i = 0; i < CONFIG.stones.count; i++) {
            let sx, sy;
            let attempts = 0;
            let overlapsWater = false;
            
            do {
                sx = this.randomAxisPoint(w, margin);
                sy = this.randomAxisPoint(h, margin);
                
                // Keep stones away from water shorelines
                overlapsWater = this.isInsideLake(sx, sy) || 
                                this.isInsideLake(sx + 50, sy) || 
                                this.isInsideLake(sx - 50, sy) || 
                                this.isInsideLake(sx, sy + 50) || 
                                this.isInsideLake(sx, sy - 50);
                attempts++;
            } while (overlapsWater && attempts < 20);
            
            // Stone size varies from 0.7x to 1.5x of baseSize
            const scale = CONFIG.stones.baseSize * (0.7 + Math.random() * 0.8);
            
            // Generate the unique pixel footprint and calculate bounds
            const { pixels, width, height, radius } = this.generateStonePixels(scale);
            
            this.stoneList.push({
                x: sx,
                y: sy,
                scale: scale,
                pixels: pixels,
                width: width,
                height: height,
                radius: radius, // physical avoidance radius
                colorIdx: Math.floor(Math.random() * CONFIG.stones.colors.length)
            });
        }
        
        // Sort stones for perfect overlapping (Y-sorted)
        this.stoneList.sort((a, b) => a.y - b.y);
    }

    // 🎨 Procedurally generates the layout of a custom pixel-art stone with highlights & shadows
    // 🎨 Procedurally generates the layout of a custom pixel-art stone with highlights, shadows, outlines, cracks and clusters
    generateStonePixels(scale) {
        // Approximate pixel-art base radius (5 to 9 pixels)
        const baseRadius = Math.round((5 + Math.random() * 4) * scale);
        
        const style = Math.floor(Math.random() * 4); // 4 unique styles
        const stretchX = 1.1 + Math.random() * 0.3;
        const rx = baseRadius * stretchX;
        const ry = baseRadius * 0.85;
        
        // Define colors
        const colors = {
            base: CONFIG.stones.colors[Math.floor(Math.random() * CONFIG.stones.colors.length)],
            highlight: '#d2d7d9', // Bright crisp stone highlight
            shadow: '#2c3e50',    // Dark rock shadow
            outline: '#1e272c',   // Chunky pixel-art outline
            crack: '#1a252f',     // Crevice/crack color
            dropShadow: 'rgba(12, 30, 14, 0.45)' // Loam drop shadow matching foot prints
        };
        
        // Setup shape function
        // Returns true if (x,y) is inside the stone structure
        const isInside = (x, y) => {
            // Main stone
            let insideMain = false;
            if (style === 2) {
                // Style 2: Triangular jagged rock
                const taper = y < 0 ? (1.0 + (y / ry) * 0.4) : 1.0;
                insideMain = (Math.pow(x / (rx * taper), 2) + Math.pow(y / ry, 2)) <= 1.0;
            } else {
                // Standard Ellipse
                insideMain = (Math.pow(x / rx, 2) + Math.pow(y / ry, 2)) <= 1.0;
            }
            
            // Companion pebbles
            let insidePebble1 = false;
            let insidePebble2 = false;
            
            if (style === 1) {
                // Style 1: Cluster with a pebble on the bottom-right
                const px = rx * 0.7;
                const py = ry * 0.5;
                const pr = baseRadius * 0.45;
                insidePebble1 = (Math.pow((x - px) / pr, 2) + Math.pow((y - py) / pr, 2)) <= 1.0;
            } else if (style === 2) {
                // Style 2: Triangular rock with a pebble on the bottom-right
                const px = rx * 0.8;
                const py = ry * 0.6;
                const pr = baseRadius * 0.4;
                insidePebble1 = (Math.pow((x - px) / pr, 2) + Math.pow((y - py) / pr, 2)) <= 1.0;
            } else if (style === 0) {
                // Style 0: Double cluster (pebble on left and right base!)
                const px1 = -rx * 0.8;
                const py1 = ry * 0.6;
                const pr1 = baseRadius * 0.45;
                insidePebble1 = (Math.pow((x - px1) / pr1, 2) + Math.pow((y - py1) / pr1, 2)) <= 1.0;
                
                const px2 = rx * 0.8;
                const py2 = ry * 0.6;
                const pr2 = baseRadius * 0.35;
                insidePebble2 = (Math.pow((x - px2) / pr2, 2) + Math.pow((y - py2) / pr2, 2)) <= 1.0;
            }
            
            return insideMain || insidePebble1 || insidePebble2;
        };
        
        // Define crack coordinates
        const isCrack = (x, y) => {
            if (style === 0) {
                // Diagonal cleavage line
                const lineVal = Math.abs(y - 1.5 * x);
                return lineVal < 1.0 && y > -ry * 0.7 && y < ry * 0.6;
            } else if (style === 3) {
                // Horizontal crack across the upper third
                const lineVal = Math.abs(y + ry * 0.2 - 0.2 * x);
                return lineVal < 0.8 && x > -rx * 0.7 && x < rx * 0.6;
            } else if (style === 1) {
                // Diagonal crack on the right side
                const lineVal = Math.abs(y - 0.8 * x + ry * 0.3);
                return lineVal < 0.8 && x > -rx * 0.3 && x < rx * 0.8;
            }
            return false;
        };
        
        // Generate shadow pixels first (flat shifted drop shadow)
        const pixelsMap = {}; // key: "dx,dy", value: pixel object
        const shadowOffsetDx = Math.round(1.5 * scale);
        const shadowOffsetDy = Math.round(1.5 * scale);
        
        for (let dx = -Math.round(rx + 5); dx <= Math.round(rx + 5); dx++) {
            for (let dy = -Math.round(ry + 5); dy <= Math.round(ry + 5); dy++) {
                // If the offset pixel is inside the shape, draw shadow at (dx, dy)
                if (isInside(dx - shadowOffsetDx, dy - shadowOffsetDy)) {
                    const key = `${dx},${dy}`;
                    pixelsMap[key] = {
                        dx: dx,
                        dy: dy,
                        color: colors.dropShadow,
                        isShadow: true
                    };
                }
            }
        }
        
        // Generate body pixels
        for (let dx = -Math.round(rx + 2); dx <= Math.round(rx + 2); dx++) {
            for (let dy = -Math.round(ry + 2); dy <= Math.round(ry + 2); dy++) {
                if (isInside(dx, dy)) {
                    const key = `${dx},${dy}`;
                    
                    // Determine if it is outline (at least one orthogonal neighbor is outside the shape)
                    const isOutlinePixel = !isInside(dx+1, dy) || !isInside(dx-1, dy) || !isInside(dx, dy+1) || !isInside(dx, dy-1);
                    
                    let color = colors.base;
                    
                    if (isOutlinePixel) {
                        color = colors.outline;
                    } else if (isCrack(dx, dy)) {
                        color = colors.crack;
                    } else {
                        // Regular body shading
                        // Light highlight on top-left edge
                        const nearTopLeftEdge = !isInside(dx - 1, dy) || !isInside(dx, dy - 1) || !isInside(dx - 1, dy - 1);
                        const nearBottomRightEdge = !isInside(dx + 1, dy) || !isInside(dx, dy + 1) || !isInside(dx + 1, dy + 1);
                        
                        if (nearTopLeftEdge) {
                            color = colors.highlight;
                        } else if (nearBottomRightEdge) {
                            color = colors.shadow;
                        } else {
                            // Speckling crystalline noise texturing!
                            const noise = Math.random();
                            if (noise < 0.15) {
                                color = colors.highlight; // Light speckle
                            } else if (noise < 0.3) {
                                color = colors.shadow;    // Dark speckle
                            }
                        }
                    }
                    
                    // Overwrite shadow pixels at overlapping spots
                    pixelsMap[key] = {
                        dx: dx,
                        dy: dy,
                        color: color,
                        isShadow: false
                    };
                }
            }
        }
        
        const pixels = Object.values(pixelsMap);
        const radius = Math.max(rx, ry) * 3;
        
        return {
            pixels: pixels,
            width: rx * 2 * 3,
            height: ry * 2 * 3,
            radius: radius
        };
    }

    // 🪨 Draw a procedurally generated chunky retro stone with crisp integer-snapped pixels
    drawPixelStone(ctx, stone) {
        const pixelSize = 3; // Fixed sharp retro pixel size matching the grass/ant resolution!
        
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        
        // Render drop shadow pixels first
        stone.pixels.forEach(p => {
            if (p.isShadow) {
                const px = Math.round(stone.x + p.dx * pixelSize);
                const py = Math.round(stone.y + p.dy * pixelSize);
                ctx.fillStyle = p.color;
                ctx.fillRect(px, py, pixelSize, pixelSize);
            }
        });
        
        // Render stone body pixels on top of shadows
        stone.pixels.forEach(p => {
            if (!p.isShadow) {
                const px = Math.round(stone.x + p.dx * pixelSize);
                const py = Math.round(stone.y + p.dy * pixelSize);
                ctx.fillStyle = p.color;
                ctx.fillRect(px, py, pixelSize, pixelSize);
            }
        });
        
        ctx.restore();
    }

    // 🏡 Procedurally generates the layout of a custom pixel-art anthill (Formigueiro)
    generateNestPixels() {
        const pixelsMap = {};
        const rx = 18;
        const ry = 13;
        
        const colors = {
            base: '#543e26',       // Deep loam dirt brown
            highlight: '#8f5c38',  // Light sandy dirt highlight (top-left)
            shadow: '#2e1c0c',     // Dark soil shadow (bottom-right)
            entrance: '#130a04',   // Black center entrance hole
            outline: '#1e272c',    // Solid retro pixel outline
            dropShadow: 'rgba(12, 30, 14, 0.45)' // Green loam shadow matching stone sways
        };
        
        // Define shape boundaries:
        const isInsideNest = (x, y) => {
            if (y > ry * 0.9) return false;
            
            // Equation for a dome-like cone shape:
            const widthAtHeight = rx * (1.0 - (ry - y) / (ry * 2.2));
            return Math.abs(x) <= widthAtHeight && y >= -ry && y <= ry;
        };
        
        // Define center entrance hole
        const isEntrance = (x, y) => {
            return (Math.pow(x / 4.0, 2) + Math.pow((y + ry * 0.2) / 2.5, 2)) <= 1.0;
        };
        
        // Flat loam drop shadow underneath the anthill (slightly offset down-right)
        const shadowOffsetDx = 2;
        const shadowOffsetDy = 2;
        for (let dx = -rx - 4; dx <= rx + 4; dx++) {
            for (let dy = -ry - 4; dy <= ry + 4; dy++) {
                if (isInsideNest(dx - shadowOffsetDx, dy - shadowOffsetDy)) {
                    const key = `${dx},${dy}`;
                    pixelsMap[key] = {
                        dx: dx,
                        dy: dy,
                        color: colors.dropShadow,
                        isShadow: true
                    };
                }
            }
        }
        
        // Generate anthill body
        for (let dx = -rx - 1; dx <= rx + 1; dx++) {
            for (let dy = -ry - 1; dy <= ry + 1; dy++) {
                if (isInsideNest(dx, dy)) {
                    const key = `${dx},${dy}`;
                    
                    // Edge outline detection
                    const isOutlinePixel = !isInsideNest(dx+1, dy) || !isInsideNest(dx-1, dy) || !isInsideNest(dx, dy+1) || !isInsideNest(dx, dy-1);
                    
                    let color = colors.base;
                    
                    if (isOutlinePixel) {
                        color = colors.outline;
                    } else if (isEntrance(dx, dy)) {
                        color = colors.entrance;
                        
                        const isEntranceEdge = !isEntrance(dx+1, dy) || !isEntrance(dx-1, dy) || !isEntrance(dx, dy+1) || !isEntrance(dx, dy-1);
                        if (isEntranceEdge) {
                            color = colors.outline;
                        }
                    } else {
                        // Loam texturing & lighting
                        const nearTopLeftEdge = !isInsideNest(dx - 1, dy) || !isInsideNest(dx, dy - 1) || !isInsideNest(dx - 1, dy - 1);
                        const nearBottomRightEdge = !isInsideNest(dx + 1, dy) || !isInsideNest(dx, dy + 1) || !isInsideNest(dx + 1, dy + 1);
                        
                        if (nearTopLeftEdge) {
                            color = colors.highlight;
                        } else if (nearBottomRightEdge) {
                            color = colors.shadow;
                        } else {
                            const noise = Math.random();
                            if (noise < 0.12) {
                                color = colors.highlight;
                            } else if (noise < 0.24) {
                                color = colors.shadow;
                            }
                        }
                    }
                    
                    // Overwrite shadow pixels
                    pixelsMap[key] = {
                        dx: dx,
                        dy: dy,
                        color: color,
                        isShadow: false
                    };
                }
            }
        }
        
        this.nestPixels = Object.values(pixelsMap);
        this.nestRadius = rx * 3;
    }

    // 🏡 Draw a procedurally generated chunky retro anthill with crisp integer-snapped pixels
    drawNest(ctx) {
        if (!this.nestPlaced || !this.nestPos) return;
        const pixelSize = 3;
        
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        
        // Render drop shadow pixels first
        this.nestPixels.forEach(p => {
            if (p.isShadow) {
                const px = Math.round(this.nestPos.x + p.dx * pixelSize);
                const py = Math.round(this.nestPos.y + p.dy * pixelSize);
                ctx.fillStyle = p.color;
                ctx.fillRect(px, py, pixelSize, pixelSize);
            }
        });
        
        // Render body pixels on top
        this.nestPixels.forEach(p => {
            if (!p.isShadow) {
                const px = Math.round(this.nestPos.x + p.dx * pixelSize);
                const py = Math.round(this.nestPos.y + p.dy * pixelSize);
                ctx.fillStyle = p.color;
                ctx.fillRect(px, py, pixelSize, pixelSize);
            }
        });
        
        ctx.restore();
    }

    // 🎨 Generates a low-res pixelated mossy forest floor background with beaches and blue lakes
    generatePixelBackground() {
        this.bgCanvas = document.createElement('canvas');
        this.bgCanvas.width = CONFIG.world.width;
        this.bgCanvas.height = CONFIG.world.height;
        const bgCtx = this.bgCanvas.getContext('2d');
        
        const pixelSize = 16; // Chunky 16x16 retro pixel blocks
        const w = this.bgCanvas.width;
        const h = this.bgCanvas.height;
        
        // Render chunky low-res warm green moss, sandy beaches, and water basins
        for (let x = 0; x < w; x += pixelSize) {
            for (let y = 0; y < h; y += pixelSize) {
                const cx = x + pixelSize / 2;
                const cy = y + pixelSize / 2;
                
                const insideWater = this.isInsideLake(cx, cy);
                
                if (insideWater) {
                    // Water base colors (organic blue noise)
                    const val = Math.random();
                    if (val < 0.25) {
                        bgCtx.fillStyle = '#1f618d'; // Deep shoreline blue
                    } else if (val < 0.8) {
                        bgCtx.fillStyle = '#2980b9'; // Beautiful base water blue
                    } else {
                        bgCtx.fillStyle = '#1b4f72'; // Dark deep water
                    }
                } else {
                    // Check if near water perimeter for sandy shoreline beaches
                    const isNearWater = this.isInsideLake(cx - 24, cy) || this.isInsideLake(cx + 24, cy) || 
                                        this.isInsideLake(cx, cy - 24) || this.isInsideLake(cx, cy + 24) ||
                                        this.isInsideLake(cx - 36, cy - 36) || this.isInsideLake(cx + 36, cy + 36);
                    
                    if (isNearWater) {
                        // Sandy beach blocks
                        const val = Math.random();
                        if (val < 0.75) {
                            bgCtx.fillStyle = CONFIG.lake.colors.sand; // Bright warm sand yellow
                        } else {
                            bgCtx.fillStyle = CONFIG.lake.colors.sandShadow; // Damp transition sand
                        }
                    } else {
                        // Default forest grass greens
                        const val = Math.random();
                        let color = '#3b853e'; // Default medium grass green
                        
                        if (val < 0.35) {
                            color = '#2e6630'; // Mossy forest green (shadows)
                        } else if (val < 0.65) {
                            color = '#3b853e'; // Warm meadow green (base)
                        } else if (val < 0.8) {
                            color = '#469c4a'; // Bright vibrant grass green
                        } else if (val < 0.92) {
                            color = '#5cb85c'; // Luminous lime green highlights
                        } else {
                            color = '#543e26'; // Warm organic loam brown details
                        }
                        bgCtx.fillStyle = color;
                    }
                }
                
                bgCtx.fillRect(x, y, pixelSize, pixelSize);
            }
        }
        
        // Add beautiful "pixelated sandy pebble / detail blocks" strictly on the grassy field (not inside water!)
        const numDetails = Math.floor((w * h) / 45000) + 3;
        for (let i = 0; i < numDetails; i++) {
            const minX = Math.floor(Math.random() * (w / pixelSize)) * pixelSize;
            const minY = Math.floor(Math.random() * (h / pixelSize)) * pixelSize;
            const minW = (1 + Math.floor(Math.random() * 2)) * pixelSize;
            const minH = (1 + Math.floor(Math.random() * 2)) * pixelSize;
            
            // Only draw detailed sandy blocks if not inside lake water
            if (!this.isInsideLake(minX + minW / 2, minY + minH / 2)) {
                bgCtx.fillStyle = 'rgba(255, 255, 255, 0.05)'; 
                bgCtx.fillRect(minX, minY, minW, minH);
                
                bgCtx.fillStyle = 'rgba(255, 255, 255, 0.08)';
                bgCtx.fillRect(minX, minY, minW, pixelSize / 4);
            }
        }
    }

    // 🌿 Populate pixel grass clumps in organic clusters and apply Y-Sorting depth layering
    generateGrass() {
        this.grassTufts = [];
        const margin = 50;
        const w = CONFIG.world.width;
        const h = CONFIG.world.height;
        
        // Define exactly 3 to 4 giant organic meadow centers across the screen
        const numCenters = 3 + Math.floor(Math.random() * 2); 
        const centers = [];
        for (let i = 0; i < numCenters; i++) {
            centers.push({
                x: this.randomAxisPoint(w, margin),
                y: this.randomAxisPoint(h, margin),
                radius: 200 + Math.random() * 200 // Giant radius (200px to 400px!)
            });
        }
        
        for (let i = 0; i < CONFIG.grass.count; i++) {
            let gx, gy;
            
            // 93% of grass is tightly clustered inside the giant centers (leaving massive empty clearings!)
            // 7% is scattered as stray wild tufts
            if (Math.random() < 0.93) {
                const center = centers[Math.floor(Math.random() * centers.length)];
                
                // Dense core distribution tapering out to feathered edges
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.pow(Math.random(), 1.5) * center.radius; 
                
                gx = center.x + Math.cos(angle) * dist;
                gy = center.y + Math.sin(angle) * dist;
            } else {
                // Stray grass clumps scattered in clearings
                gx = this.randomAxisPoint(w, margin);
                gy = this.randomAxisPoint(h, margin);
            }
            
            // Ensure strictly inside boundaries and doesn't spawn inside a stone or water
            let attempts = 0;
            let overlapsStone = false;
            let overlapsWater = false;
            do {
                if (attempts > 0) {
                    if (Math.random() < 0.93) {
                        const center = centers[Math.floor(Math.random() * centers.length)];
                        const angle = Math.random() * Math.PI * 2;
                        const dist = Math.pow(Math.random(), 1.5) * center.radius; 
                        gx = center.x + Math.cos(angle) * dist;
                        gy = center.y + Math.sin(angle) * dist;
                    } else {
                        gx = this.randomAxisPoint(w, margin);
                        gy = this.randomAxisPoint(h, margin);
                    }
                }
                
                gx = this.clampAxisPoint(gx, w, margin);
                gy = this.clampAxisPoint(gy, h, margin);
                
                overlapsStone = false;
                for (const stone of this.stoneList) {
                    const dist = Math.hypot(gx - stone.x, gy - stone.y);
                    if (dist < stone.radius * 1.5) {
                        overlapsStone = true;
                        break;
                    }
                }
                
                // Also check if overlaps water or sandy beach transition zone
                overlapsWater = this.isInsideLake(gx, gy) || 
                                this.isInsideLake(gx + 30, gy) || 
                                this.isInsideLake(gx - 30, gy) || 
                                this.isInsideLake(gx, gy + 30) || 
                                this.isInsideLake(gx, gy - 30);
                
                attempts++;
            } while ((overlapsStone || overlapsWater) && attempts < 25);
            
            const size = CONFIG.grass.baseSize * (0.7 + Math.random() * 0.5);
            const { pixels, maxHeight } = this.generateGrassClumpPixels(size);
            
            this.grassTufts.push({
                x: gx,
                y: gy,
                size: size,
                pixels: pixels,
                maxHeight: maxHeight,
                rustlePhase: 0,
                rustleSpeed: 0,
                isRustling: false
            });
        }
        
        // Sort grass clumps from top to bottom (by Y coordinate) for perfect depth overlapping
        this.grassTufts.sort((a, b) => a.y - b.y);
    }

    // 🎨 Procedurally generates the layout of a custom pixel-art grass clump at startup
    generateGrassClumpPixels(sizeScale) {
        const pixels = [];
        const numBlades = 3 + Math.floor(Math.random() * 3); // 3 to 5 blades per clump
        let maxHeight = 0;
        
        // Mossy forest colors
        const colors = [
            '#1b4f24', // 0: Deep Forest Green (Shadows)
            '#27ae60', // 1: Emerald Meadow Green (Base)
            '#2ecc71', // 2: Neon Lime Green (Highlight/Tips)
            '#145a32'  // 3: Dark Earthy Green (Roots/Anchor)
        ];
        
        for (let b = 0; b < numBlades; b++) {
            // Base X offset from the clump center (-3 to +3 retro-pixels)
            const baseDx = -3 + Math.floor(Math.random() * 7);
            
            // Blade height (between 8 and 16 retro-pixels, scaled)
            const height = Math.floor((8 + Math.random() * 9) * sizeScale);
            if (height > maxHeight) maxHeight = height;
            
            // Bend factor (-0.35 for strong left curve, +0.35 for strong right curve)
            const curve = -0.35 + Math.random() * 0.7;
            
            // Base thickness (2 or 3 retro-pixels)
            const baseWidth = Math.random() > 0.45 ? 3 : 2;
            
            for (let dy = 0; dy >= -height; dy--) {
                const t = -dy / height; // Interpolator from 0.0 (base) to 1.0 (tip)
                
                // Curve is quadratic: dy^2 gives an organic natural bending shape!
                const curveOffset = curve * Math.pow(t, 2) * 5;
                const dxCenter = baseDx + curveOffset;
                
                // Narrow the blade as it reaches the top
                let width = baseWidth;
                if (t > 0.35) width = Math.max(1, baseWidth - 1);
                if (t > 0.75) width = 1;
                
                const startDx = Math.round(dxCenter - (width - 1) / 2);
                
                for (let w = 0; w < width; w++) {
                    const dx = startDx + w;
                    
                    let color;
                    if (dy >= -1) {
                        color = colors[3]; // Deep anchor/root green
                    } else if (t > 0.8) {
                        color = colors[2]; // Luminous highlight tips
                    } else if (w === 0 && curve < 0) {
                        color = colors[0]; // Left shadow side
                    } else if (w === width - 1 && curve > 0) {
                        color = colors[2]; // Right highlight side
                    } else {
                        // Alternate between base and shadow for rich texture
                        color = (b + dy + w) % 3 === 0 ? colors[0] : colors[1];
                    }
                    
                    // Deduplicate coordinates: keep brighter highlights/base colors if coordinate overlaps
                    const existingIdx = pixels.findIndex(p => p.dx === dx && p.dy === dy);
                    if (existingIdx !== -1) {
                        const existingColor = pixels[existingIdx].color;
                        if (color === '#2ecc71' || (color === '#27ae60' && existingColor === '#1b4f24')) {
                            pixels[existingIdx].color = color;
                        }
                    } else {
                        pixels.push({ dx, dy, color });
                    }
                }
            }
        }
        
        return { pixels, maxHeight };
    }

    spawnAnt(x, y) {
        if (this.ants.length >= CONFIG.ant.maxCount) {
            return false;
        }

        this.ants.push(new Ant(x, y, this));
        return true;
    }

    addTroddenTrail(trail) {
        if (this.troddenTrails.length >= CONFIG.effects.maxTrails) {
            this.troddenTrails.shift();
        }

        this.troddenTrails.push(trail);
    }

    showToast(message) {
        const existing = document.getElementById('pixel-toast-alert');
        if (existing) {
            existing.remove();
        }
        
        const toast = document.createElement('div');
        toast.id = 'pixel-toast-alert';
        toast.className = 'pixel-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 3000);
    }

    handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const worldPos = this.screenToWorld(sx, sy);
        
        if (this.placementMode === 'nest') {
            // 🌊 Nest placement water boundary check!
            if (this.isInsideLake(worldPos.x, worldPos.y)) {
                this.showToast("CANNOT BUILD HOME IN WATER!");
                return;
            }
            
            this.nestPos = { x: worldPos.x, y: worldPos.y };
            this.generateNestPixels();
            this.nestPlaced = true;
            this.placementMode = null;
            
            // Toggle UI buttons
            const placeBtn = document.getElementById('btn-place-nest');
            if (placeBtn) placeBtn.style.display = 'none';
            const spawnBtn = document.getElementById('btn-spawn-ant');
            if (spawnBtn) spawnBtn.style.display = 'block';
            
            this.canvas.style.cursor = 'crosshair';
            
            // Persist nest placement in local storage!
            this.saveWorldToLocalStorage();

            // Spawn 3 initial ants emerging from the nest as a delightful reward!
            for (let k = 0; k < 3; k++) {
                setTimeout(() => {
                    this.spawnAnt(this.nestPos.x, this.nestPos.y);
                }, k * 180);
            }
        } else {
            // Place a pulsing target marker in virtual world space
            this.markers.push({
                x: worldPos.x,
                y: worldPos.y,
                radius: 8,
                pulsePhase: 0,
                pulseSpeed: 0.1,
                intensity: 1.0
            });
        }
    }

    gameLoop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        let dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;
        
        if (dt > 0.1) dt = 0.1;
        
        this.update(dt);
        this.render();
        
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    update(dt) {
        // Smoothly interpolate (lerp) camera zoom scale
        const prevZoom = this.cameraZoom;
        this.cameraZoom += (this.targetZoom - this.cameraZoom) * this.zoomLerpSpeed;
        
        // Shift camera center dynamically during zoom animation to keep target pinned under the cursor
        if (Math.abs(this.cameraZoom - prevZoom) > 0.0001) {
            const w = this.canvas.width;
            const h = this.canvas.height;
            
            // Shift camera center
            this.cameraX += (this.mouseX - w / 2) * (1 / prevZoom - 1 / this.cameraZoom);
            this.cameraY += (this.mouseY - h / 2) * (1 / prevZoom - 1 / this.cameraZoom);
            
            this.clampCamera();
        }

        // 🌊 Spawn glistening water ripples dynamically inside lake boundaries
        if (this.waterRipples.length < CONFIG.lake.rippleCount && Math.random() < 0.25) {
            const lake = CONFIG.lake.lakes[Math.floor(Math.random() * CONFIG.lake.lakes.length)];
            
            let rx = (Math.random() - 0.5) * lake.rx * 1.7;
            let ry = (Math.random() - 0.5) * lake.ry * 1.7;
            let wx = lake.x + rx;
            let wy = lake.y + ry;
            
            if (this.isInsideLake(wx, wy)) {
                this.waterRipples.push({
                    x: wx,
                    y: wy,
                    length: 12 + Math.floor(Math.random() * 20), // Shimmer line length in world pixels
                    life: 0,
                    maxLife: 1.5 + Math.random() * 2.0,          // Duration 1.5s to 3.5s
                    speed: -15 + Math.random() * 30,             // Soft horizontal drift speed
                    color: Math.random() > 0.4 ? 'rgba(93, 173, 226, 0.45)' : 'rgba(255, 255, 255, 0.35)' // High contrast shimmer color
                });
            }
        }
        
        // Update active water ripples
        for (let i = this.waterRipples.length - 1; i >= 0; i--) {
            const r = this.waterRipples[i];
            r.life += dt;
            r.x += r.speed * dt;
            
            // Wave length dynamics
            r.x += Math.sin(r.life * 4.0) * 0.15;
            
            if (r.life >= r.maxLife || !this.isInsideLake(r.x, r.y)) {
                this.waterRipples.splice(i, 1);
            }
        }
        // Update markers (pulse and decay)
        for (let i = this.markers.length - 1; i >= 0; i--) {
            const marker = this.markers[i];
            marker.pulsePhase += marker.pulseSpeed;
            marker.intensity -= 0.03 * dt;
            if (marker.intensity <= 0) {
                this.markers.splice(i, 1);
            }
        }
        
        // Update particles (gravity/friction and fade)
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            
            // Slow down particles over time (simulate friction)
            p.vx *= 0.95;
            p.vy *= 0.95;
            
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // 💨 Advance the global wind breeze cycle
        this.windTime += dt * CONFIG.grass.windSpeed;

        // 🌿 Update grass rustle sways based on ant distances
        this.grassTufts.forEach(grass => {
            let nearAnt = false;
            this.ants.forEach(ant => {
                const dist = Math.hypot(ant.x - grass.x, ant.y - grass.y);
                if (dist < CONFIG.grass.rustleDistance) {
                    nearAnt = true;
                }
            });

            if (nearAnt) {
                grass.isRustling = true;
                if (grass.rustleSpeed === 0) {
                    grass.rustleSpeed = 15;
                }
            }

            if (grass.isRustling) {
                // Swing harmonic vibration phase
                grass.rustlePhase += dt * CONFIG.grass.animationSpeed;
                
                // If the ant walked away, dampen down the speed slowly
                if (!nearAnt) {
                    grass.rustleSpeed *= 0.93; // Damping
                    if (grass.rustleSpeed < 0.2) {
                        grass.isRustling = false;
                        grass.rustlePhase = 0;
                        grass.rustleSpeed = 0;
                    }
                }
            }
        });

        // 🌸 Update flower rustle sways based on ant distances (distinct threshold!)
        this.flowerList.forEach(flower => {
            let nearAnt = false;
            this.ants.forEach(ant => {
                const dist = Math.hypot(ant.x - flower.x, ant.y - flower.y);
                if (dist < CONFIG.flowers.rustleDistance) {
                    nearAnt = true;
                }
            });

            if (nearAnt) {
                flower.isRustling = true;
                if (flower.rustleSpeed === 0) {
                    flower.rustleSpeed = 12; // Spring amplitude
                }
            }

            if (flower.isRustling) {
                flower.rustlePhase += dt * CONFIG.flowers.animationSpeed;
                
                if (!nearAnt) {
                    flower.rustleSpeed *= 0.90; // Dampen down faster (flowers are more rigid)
                    if (flower.rustleSpeed < 0.2) {
                        flower.isRustling = false;
                        flower.rustlePhase = 0;
                        flower.rustleSpeed = 0;
                    }
                }
            }
        });

        // 💨 Spawn visual pixel-art wind gusts periodically (sync'd to grass sways!)
        this.windGustTimer -= dt;
        if (this.windGustTimer <= 0) {
            this.windGusts.push(new WindGust(Math.random() * CONFIG.world.height, this));
            this.windGustTimer = 3.5 + Math.random() * 4.0; // Spawn every 3.5 - 7.5 seconds
        }

        // Update active wind gusts
        for (let i = this.windGusts.length - 1; i >= 0; i--) {
            const gust = this.windGusts[i];
            gust.update(dt);
            if (gust.life >= gust.maxLife) {
                this.windGusts.splice(i, 1);
            }
        }
        
        // 👣 Update and decay active footprint & highway trails (3 seconds decay back to base!)
        for (let i = this.troddenTrails.length - 1; i >= 0; i--) {
            const trail = this.troddenTrails[i];
            trail.life -= dt;
            if (trail.life <= 0) {
                this.troddenTrails.splice(i, 1);
            }
        }
        
        // Update ants
        this.ants.forEach(ant => ant.update(dt));
    }

    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        // Clear full canvas first to prevent screen tearing/flickering
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);
        
        ctx.save();
        
        // 🎥 Apply Matrix Camera Panning & Zooming Transforms
        // 1. Center viewport space at the screen center (w/2, h/2)
        ctx.translate(w / 2, h / 2);
        // 2. Scale coordinate space by current zoom factor
        ctx.scale(this.cameraZoom, this.cameraZoom);
        // 3. Move camera center to coordinates (cameraX, cameraY) in world space
        ctx.translate(-this.cameraX, -this.cameraY);
        
        // 1. Draw pre-rendered high-performance pixel background
        if (this.bgCanvas) {
            ctx.drawImage(this.bgCanvas, 0, 0);
        } else {
            ctx.fillStyle = '#3b853e';
            ctx.fillRect(0, 0, CONFIG.world.width, CONFIG.world.height);
        }

        // 🌊 Render animated pixel-art water waves and highlights snapping to the 16px grid!
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        const grid = 16;
        const worldW = CONFIG.world.width;
        const worldH = CONFIG.world.height;
        const time = (performance.now() / 1000); // Dynamic float time in seconds
        
        // Loop over lakes and draw moving water highlights
        CONFIG.lake.lakes.forEach((lake, lIdx) => {
            // Define bounding box of the lake to keep loop bounds extremely tight and high performance!
            const pad = 50;
            const startX = Math.floor(Math.max(0, lake.x - lake.rx - pad) / grid) * grid;
            const endX = Math.ceil(Math.min(worldW, lake.x + lake.rx + pad) / grid) * grid;
            const startY = Math.floor(Math.max(0, lake.y - lake.ry - pad) / grid) * grid;
            const endY = Math.ceil(Math.min(worldH, lake.y + lake.ry + pad) / grid) * grid;
            
            for (let gx = startX; gx < endX; gx += grid) {
                for (let gy = startY; gy < endY; gy += grid) {
                    const cx = gx + grid / 2;
                    const cy = gy + grid / 2;
                    
                    // Verify if this grid coordinate falls inside this specific lake
                    if (this.isInsideLakeOf(cx, cy, lake)) {
                        // Draw animated shimmering textures that drift over time!
                        const shiftX = Math.round(Math.sin(time * 1.2 + (cy * 0.04)) * 7.0);
                        const waveVal = Math.sin((cx + shiftX) * 0.07 + time * 2.2 + lIdx);
                        
                        if (waveVal > 0.72) {
                            // Bright Glistening Wave crest highlight (light blue)
                            ctx.fillStyle = CONFIG.lake.colors.highlight;
                            ctx.globalAlpha = 0.40;
                            // Snapped retro wave highlight line
                            ctx.fillRect(gx + 1, gy + 6, grid - 2, 2); 
                        } else if (waveVal < -0.74) {
                            // Dark Deep Wave trough (deep blue navy)
                            ctx.fillStyle = CONFIG.lake.colors.deep;
                            ctx.globalAlpha = 0.45;
                            ctx.fillRect(gx + 1, gy + 10, grid - 2, 2);
                        }
                    }
                }
            }
        });
        ctx.restore();
        
        // 🌊 Render dynamic shimmering water ripples on top of the water basins
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        const ripplePixelSize = 3;
        this.waterRipples.forEach(r => {
            const ratio = r.life / r.maxLife;
            const fade = ratio < 0.2 ? (ratio / 0.2) : (1.0 - (ratio - 0.2) / 0.8);
            
            ctx.fillStyle = r.color;
            ctx.globalAlpha = Math.max(0, Math.min(1, fade));
            ctx.fillRect(
                Math.round(r.x), 
                Math.round(r.y), 
                Math.round(r.length), 
                ripplePixelSize
            );
        });
        ctx.restore();
        
        // 👣 Render dynamic decaying footprint & highway trails (fades after 3 seconds!)
        this.troddenTrails.forEach(trail => {
            const ratio = trail.life / trail.maxLife;
            // Snappy loam-soil color snapping back to base green background
            const opacity = ratio * (trail.type === 'highway' ? 0.08 : 0.40);
            ctx.fillStyle = `rgba(12, 30, 14, ${opacity})`;
            ctx.fillRect(trail.x, trail.y, trail.size, trail.size);
        });
        
        // 2. Render bioluminescent lights under each ant to illuminate the pixel background!
        this.ants.forEach(ant => {
            ctx.save();
            const glowRadius = 55 * ant.size;
            const lightGlow = ctx.createRadialGradient(
                ant.x, ant.y, 1, 
                ant.x, ant.y, glowRadius
            );
            lightGlow.addColorStop(0, 'rgba(211, 84, 0, 0.24)'); // Bioluminescent warm amber glow
            lightGlow.addColorStop(0.4, 'rgba(211, 84, 0, 0.06)');
            lightGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            ctx.fillStyle = lightGlow;
            ctx.beginPath();
            ctx.arc(ant.x, ant.y, glowRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        // 3. Render target markers (with pixelated style)
        this.markers.forEach(marker => {
            const pulseRadius = marker.radius + Math.sin(marker.pulsePhase) * 3;
            
            // Neon violet pheromone glow
            const glow = ctx.createRadialGradient(
                marker.x, marker.y, 1, 
                marker.x, marker.y, pulseRadius * 2.5
            );
            glow.addColorStop(0, `hsla(280, 80%, 60%, ${0.5 * marker.intensity})`);
            glow.addColorStop(0.5, `hsla(280, 80%, 60%, ${0.15 * marker.intensity})`);
            glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(marker.x, marker.y, pulseRadius * 2.5, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = `hsla(280, 85%, 65%, ${marker.intensity})`;
            ctx.beginPath();
            ctx.arc(marker.x, marker.y, 4, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = `hsla(280, 80%, 70%, ${0.4 * marker.intensity})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(marker.x, marker.y, pulseRadius, 0, Math.PI * 2);
            ctx.stroke();
        });
        
        // 4. Render chunky pixelated dust particles kicked up by the ant
        ctx.save();
        this.particles.forEach(p => {
            ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${p.life / p.maxLife})`;
            ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
        });
        ctx.restore();
        
        // 5. Gather all Y-sorted renderable entities (Grass, Flowers, Ants) for perfect 2.5D overlapping!
        const renderables = [];
        
        // Add grass tufts
        this.grassTufts.forEach(grass => {
            renderables.push({
                y: grass.y,
                type: 'grass',
                data: grass
            });
        });
        
        // Add flowers (only if preloader has completed loading them)
        if (this.flowerFramesLoaded === CONFIG.flowers.paths.length) {
            this.flowerList.forEach(flower => {
                renderables.push({
                    y: flower.y,
                    type: 'flower',
                    data: flower
                });
            });
        }
        
        // Add stones
        this.stoneList.forEach(stone => {
            renderables.push({
                y: stone.y,
                type: 'stone',
                data: stone
            });
        });
        
        // Add Formigueiro (anthill) if placed
        if (this.nestPlaced && this.nestPos) {
            renderables.push({
                y: this.nestPos.y,
                type: 'nest',
                data: this
            });
        }
        
        // Add ants
        this.ants.forEach(ant => {
            renderables.push({
                y: ant.y,
                type: 'ant',
                data: ant
            });
        });
        
        // Sort rendering list by Y-coordinate so lower items render in front of higher items!
        renderables.sort((a, b) => a.y - b.y);
        
        // Disable image smoothing globally to enforce razor-sharp pixels on scaled sprites!
        ctx.imageSmoothingEnabled = false;
        ctx.mozImageSmoothingEnabled = false;
        ctx.webkitImageSmoothingEnabled = false;
        ctx.msImageSmoothingEnabled = false;
        
        // Render each entity in sorted sequence (wind wave blows left-to-right matching the gusts!)
        renderables.forEach(r => {
            if (r.type === 'grass') {
                const windWave = Math.sin(this.windTime - r.data.x * CONFIG.grass.windWaveScale);
                const windSwayAngle = windWave * CONFIG.grass.windStrength;
                this.drawPixelGrass(ctx, r.data, windSwayAngle);
            } else if (r.type === 'flower') {
                const windWave = Math.sin(this.windTime - r.data.x * CONFIG.grass.windWaveScale);
                const windSwayAngle = windWave * CONFIG.flowers.swayStrength;
                this.drawFlower(ctx, r.data, windSwayAngle);
            } else if (r.type === 'stone') {
                this.drawPixelStone(ctx, r.data);
            } else if (r.type === 'nest') {
                this.drawNest(ctx);
            } else if (r.type === 'ant') {
                r.data.render(ctx);
            }
        });

        // 💨 6. Draw visual pixel-art wind gusts/smoke trails on top of the meadow!
        this.windGusts.forEach(gust => gust.render(ctx));
        
        ctx.restore();
    }

    // 🌿 Draw a beautiful, fully procedural pixel-art grass clump with crisp integer-snapped scanline shearing!
    drawPixelGrass(ctx, grass, windSwayAngle) {
        const pixelSize = 3; // Fixed sharp retro pixel size matching the ant sprite's resolution!
        
        // Combine rolling wind wave sway and active ant rustling vibration
        // Expressed as a horizontal retro-pixel shift amplitude
        const maxSwayShift = windSwayAngle * 10 + (grass.isRustling ? Math.sin(grass.rustlePhase) * 2.5 : 0);
        
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        
        grass.pixels.forEach(p => {
            // Apply horizontal shear sway based on height
            // sway scales non-linearly with height (height above ground is -p.dy)
            const heightRatio = -p.dy / grass.maxHeight;
            const swayShift = maxSwayShift * Math.pow(heightRatio, 1.5);
            
            // Calculate perfect, grid-snapped coordinates
            const px = Math.round(grass.x + (p.dx + swayShift) * pixelSize);
            const py = Math.round(grass.y + p.dy * pixelSize);
            
            ctx.fillStyle = p.color;
            ctx.fillRect(px, py, pixelSize, pixelSize);
        });
        
        ctx.restore();
    }

    // 🌸 Render a loaded flower image tilting gently in the wind from its base
    drawFlower(ctx, flower, windSwayAngle) {
        if (this.flowerFramesLoaded < CONFIG.flowers.paths.length) return;
        const img = this.flowerFrames[flower.imgIndex];
        if (!img || !img.complete) return;
        
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        
        const renderWidth = img.width * flower.scale;
        const renderHeight = img.height * flower.scale;
        
        // Combine wind sway with dynamic brushing/rustling oscillation
        const totalSway = windSwayAngle + (flower.isRustling ? Math.sin(flower.rustlePhase) * 0.12 : 0);
        
        // Pivot point at the center-bottom of the flower image
        ctx.translate(flower.x, flower.y);
        ctx.rotate(totalSway);
        
        // Draw centered horizontally and sitting exactly on the y-coordinate (so base is at y)
        ctx.drawImage(img, -renderWidth / 2, -renderHeight, renderWidth, renderHeight);
        
        ctx.restore();
    }
}

/**
 * Procedural/Sprite Ant Actor
 */
class Ant {
    constructor(x, y, game) {
        this.x = x;
        this.y = y;
        this.game = game;
        
        // Load properties dynamically from CONFIG
        this.size = CONFIG.ant.size;
        this.speed = CONFIG.ant.speed;
        this.animationSpeedFactor = CONFIG.ant.animationSpeedFactor;
        this.angularSpeed = CONFIG.ant.angularSpeed;
        this.animationPattern = CONFIG.ant.animationPattern;
        
        // Internal AI and state parameters
        this.angle = Math.random() * Math.PI * 2;
        this.target = null;
        this.wanderTime = 0;
        this.wanderAngleOffset = 0;
        this.crawlPhase = Math.random() * 100;
        this.lastStepPhase = Math.floor(this.crawlPhase);
        this.isMoving = false;
        this.facing = 'RIGHT'; 
        
        // Fallback color
        this.color = '#d35400'; 
    }

    update(dt) {
        this.isMoving = false;
        this.findTarget();
        
        if (this.target) {
            this.steerTowards(this.target.x, this.target.y, dt);
            this.isMoving = true;
            
            const dist = Math.hypot(this.target.x - this.x, this.target.y - this.y);
            if (dist < 8) {
                const index = this.game.markers.indexOf(this.target);
                if (index !== -1) {
                    this.game.markers.splice(index, 1);
                }
                this.target = null;
            }
        } else {
            this.wander(dt);
            this.isMoving = true;
        }
        
        // Apply retro stone obstacle avoidance steering force
        this.avoidStones(dt);
        
        // Apply shoreline water avoidance steering force
        this.avoidWater(dt);
        
        if (this.isMoving) {
            this.x += Math.cos(this.angle) * this.speed * dt;
            this.y += Math.sin(this.angle) * this.speed * dt;
            this.crawlPhase += this.speed * dt * this.animationSpeedFactor;
            
            // Update facing direction based on horizontal movement
            const vx = Math.cos(this.angle);
            if (vx > 0.1) {
                this.facing = 'RIGHT';
            } else if (vx < -0.1) {
                this.facing = 'LEFT';
            }

            // 🐾 Stamp dynamic "worn-down path" & "footprints" that decay organically over 3 seconds!
            const pixelSize = 16;
            const gridX = Math.floor(this.x / pixelSize) * pixelSize;
            const gridY = Math.floor(this.y / pixelSize) * pixelSize;
            
            // Check if there is already an active highway trail at this grid cell; if so, refresh its life!
            const existingHighway = this.game.troddenTrails.find(t => t.x === gridX && t.y === gridY && t.size === pixelSize);
            if (existingHighway) {
                existingHighway.life = 3.0; // Refresh to full 3 seconds
            } else {
                this.game.addTroddenTrail({
                    x: gridX,
                    y: gridY,
                    size: pixelSize,
                    life: 3.0,
                    maxLife: 3.0,
                    type: 'highway'
                });
            }
            
            // 👣 Alternating left/right feet footprints
            const currentStep = Math.floor(this.crawlPhase);
            if (currentStep !== this.lastStepPhase) {
                this.lastStepPhase = currentStep;
                
                const side = (currentStep % 2 === 0) ? -1 : 1;
                const footAngle = this.angle + (Math.PI / 2) * side;
                const footDist = 4 * this.size;
                
                const fx = this.x + Math.cos(footAngle) * footDist - Math.cos(this.angle) * (1 * this.size);
                const fy = this.y + Math.sin(footAngle) * footDist - Math.sin(this.angle) * (1 * this.size);
                
                const px = Math.round(fx);
                const py = Math.round(fy);
                
                this.game.addTroddenTrail({
                    x: px,
                    y: py,
                    size: 2, // 2x2 screenspace footprint size
                    life: 3.0, // Fades after 3 seconds
                    maxLife: 3.0,
                    type: 'footprint'
                });
            }

            // 💨 Emit tiny chunky pixel dust particles kicked up by crawling feet!
            if (this.game.particles.length < CONFIG.effects.maxParticles && Math.random() < 0.3) {
                const oppositeAngle = this.angle + Math.PI + (Math.random() - 0.5) * 0.8;
                const pSpeed = 15 + Math.random() * 30;
                
                // Mix of dark dirt-brown particles and glowing bioluminescent amber-orange specs
                const isAmber = Math.random() < 0.45;
                const r = isAmber ? 230 : 74;
                const g = isAmber ? 126 : 43;
                const b = isAmber ? 34 : 12;
                
                // Offset particle spawning position to the rear/feet of the ant
                const backX = this.x - Math.cos(this.angle) * 10 * this.size;
                const backY = this.y - Math.sin(this.angle) * 10 * this.size;
                
                this.game.particles.push({
                    x: backX + (Math.random() - 0.5) * 8 * this.size,
                    y: backY + (Math.random() - 0.5) * 8 * this.size,
                    vx: Math.cos(oppositeAngle) * pSpeed,
                    vy: Math.sin(oppositeAngle) * pSpeed,
                    size: 2 + Math.floor(Math.random() * 3), // 2px to 4px chunky retro sizes
                    r: r, g: g, b: b,
                    life: 0.3 + Math.random() * 0.4, // duration in seconds
                    maxLife: 0.7
                });
            }
        }
        
        // Keep inside virtual world boundaries
        const padding = 20;
        const w = CONFIG.world.width;
        const h = CONFIG.world.height;
        const horizontalPadding = Math.min(padding, w / 2);
        const verticalPadding = Math.min(padding, h / 2);
        const minX = horizontalPadding;
        const maxX = Math.max(minX, w - horizontalPadding);
        const minY = verticalPadding;
        const maxY = Math.max(minY, h - verticalPadding);
        
        if (this.x < minX) { this.x = minX; this.angle = Math.PI - this.angle; }
        if (this.x > maxX) { this.x = maxX; this.angle = Math.PI - this.angle; }
        if (this.y < minY) { this.y = minY; this.angle = -this.angle; }
        if (this.y > maxY) { this.y = maxY; this.angle = -this.angle; }
    }

    findTarget() {
        if (this.game.markers.length === 0) {
            this.target = null;
            return;
        }
        
        let minDist = Infinity;
        let closest = null;
        
        this.game.markers.forEach(marker => {
            const d = Math.hypot(marker.x - this.x, marker.y - this.y);
            if (d < minDist) {
                minDist = d;
                closest = marker;
            }
        });
        
        this.target = closest;
    }

    steerTowards(targetX, targetY, dt) {
        const desiredAngle = Math.atan2(targetY - this.y, targetX - this.x);
        let angleDiff = desiredAngle - this.angle;
        
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        
        const rotationStep = this.angularSpeed * dt;
        if (Math.abs(angleDiff) < rotationStep) {
            this.angle = desiredAngle;
        } else {
            this.angle += Math.sign(angleDiff) * rotationStep;
        }
    }

    wander(dt) {
        this.wanderTime -= dt;
        if (this.wanderTime <= 0) {
            this.wanderAngleOffset = (Math.random() - 0.5) * 1.5;
            this.wanderTime = 0.5 + Math.random() * 1.5;
        }
        this.angle += this.wanderAngleOffset * dt * 2;
    }

    // 🪨 Steering obstacle avoidance for procedural stones (smooth slide and push-out physics)
    // 🪨 Steering obstacle avoidance for procedural stones (smooth slide and push-out physics)
    avoidStones(dt) {
        let steerX = 0;
        let steerY = 0;
        let count = 0;
        
        this.game.stoneList.forEach(stone => {
            const dist = Math.hypot(this.x - stone.x, this.y - stone.y);
            const avoidDist = stone.radius * CONFIG.stones.avoidRadiusFactor;
            
            if (dist < avoidDist) {
                // If clipping inside the stone body, push out instantly (nudge physics)
                if (dist < stone.radius - 2) {
                    const pushDist = (stone.radius - 2) - dist;
                    const angle = dist > 0 ? Math.atan2(this.y - stone.y, this.x - stone.x) : Math.random() * Math.PI * 2;
                    this.x += Math.cos(angle) * pushDist;
                    this.y += Math.sin(angle) * pushDist;
                }
                
                // Avoidance force increases as distance decreases
                const force = (avoidDist - dist) / avoidDist;
                
                // Vector pointing away from the stone center
                steerX += (this.x - stone.x) * force;
                steerY += (this.y - stone.y) * force;
                count++;
            }
        });
        
        if (count > 0) {
            const desiredAngle = Math.atan2(steerY, steerX);
            let angleDiff = desiredAngle - this.angle;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            
            this.angle += angleDiff * dt * 4.5;
        }
    }

    // 🌊 Steering obstacle avoidance for water shorelines (slide along sandy beaches and push-out physics)
    avoidWater(dt) {
        const step = 16;
        
        // If ant is inside water (safety nudge), push it back onto sand instantly
        if (this.game.isInsideLake(this.x, this.y)) {
            let pushX = 0;
            let pushY = 0;
            
            const sampleAngles = [0, Math.PI/4, Math.PI/2, 3*Math.PI/4, Math.PI, -3*Math.PI/4, -Math.PI/2, -Math.PI/4];
            for (const angle of sampleAngles) {
                const sx = this.x + Math.cos(angle) * step;
                const sy = this.y + Math.sin(angle) * step;
                if (!this.game.isInsideLake(sx, sy)) {
                    pushX = Math.cos(angle);
                    pushY = Math.sin(angle);
                    break;
                }
            }
            
            if (pushX !== 0 || pushY !== 0) {
                this.x += pushX * 3.5;
                this.y += pushY * 3.5;
                this.angle = Math.atan2(pushY, pushX);
            }
            return;
        }
        
        // Shoreline steering force if approaching water boundary
        let isNearWater = false;
        let steerX = 0;
        let steerY = 0;
        
        const buffer = CONFIG.lake.avoidRadiusBuffer;
        const numSamples = 12;
        for (let i = 0; i < numSamples; i++) {
            const angle = (i / numSamples) * Math.PI * 2;
            const sx = this.x + Math.cos(angle) * buffer;
            const sy = this.y + Math.sin(angle) * buffer;
            
            if (this.game.isInsideLake(sx, sy)) {
                isNearWater = true;
                steerX += -Math.cos(angle);
                steerY += -Math.sin(angle);
            }
        }
        
        if (isNearWater) {
            const desiredAngle = Math.atan2(steerY, steerX);
            let angleDiff = desiredAngle - this.angle;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            
            this.angle += angleDiff * dt * 5.0;
        }
    }

    render(ctx) {
        const frameCount = CONFIG.antFramePaths.length;
        
        // If all specified sprite frames are fully loaded, render the sprite walk cycle!
        if (frameCount > 0 && this.game.antFramesLoaded === frameCount) {
            // Cycle frame index based on distance traveled and custom pattern
            const cycleIndex = Math.floor(this.crawlPhase) % this.animationPattern.length;
            const targetIndex = this.animationPattern[cycleIndex] || 0;
            
            // Defensively clamp to loaded frames array bounds
            const maxFrameIndex = this.game.antFrames.length - 1;
            const frameIndex = Math.max(0, Math.min(maxFrameIndex, targetIndex));
            const img = this.game.antFrames[frameIndex];
            
            if (img && img.complete) {
                ctx.save();
                ctx.translate(this.x, this.y);
                
                // Flip horizontally based on facing direction (no vertical rotation!)
                if (this.facing === 'LEFT') {
                    ctx.scale(-this.size, this.size); // Mirrored to face LEFT
                } else {
                    ctx.scale(this.size, this.size);  // Facing RIGHT naturally
                }
                
                // 👥 Crisp retro pixel-art drop shadow!
                // Offset down-right. We invert local X offset when facing LEFT 
                // so the shadow always casts to the bottom-right in world space!
                ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
                ctx.shadowBlur = 0; // Crisp sharp borders with no fuzzy blur
                ctx.shadowOffsetX = (this.facing === 'LEFT') ? -3.5 : 3.5;
                ctx.shadowOffsetY = 4.5;
                
                // Draw the sprite centered
                const baseWidth = 55; // Render width
                const aspectRatio = img.width / img.height;
                const baseHeight = baseWidth / aspectRatio;
                
                ctx.drawImage(img, -baseWidth / 2, -baseHeight / 2, baseWidth, baseHeight);
                ctx.restore();
                return; // Exit render, bypassing procedural fallback drawer
            }
        }

        // --- PROCEDURAL FALLBACK DRAWER (drawn if assets fail or are loading) ---
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.scale(this.size, this.size);
        
        ctx.fillStyle = this.color;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        const crawl = this.crawlPhase;
        
        // Crawling legs configuration
        const legConfigs = [
            { side: -1, offsetAngle: -0.4, timeOffset: 0,        xLoc: -1, yLoc: -2, len1: 6, len2: 8 },
            { side: -1, offsetAngle: 0.1,  timeOffset: Math.PI,  xLoc: -1, yLoc: 0,  len1: 7, len2: 7 },
            { side: -1, offsetAngle: 0.6,  timeOffset: 0,        xLoc: -1, yLoc: 2,  len1: 6, len2: 9 },
            { side: 1,  offsetAngle: 0.4,  timeOffset: Math.PI,  xLoc: 1,  yLoc: -2, len1: 6, len2: 8 },
            { side: 1,  offsetAngle: -0.1, timeOffset: 0,        xLoc: 1,  yLoc: 0,  len1: 7, len2: 7 },
            { side: 1,  offsetAngle: -0.6, timeOffset: Math.PI,  xLoc: 1,  yLoc: 2,  len1: 6, len2: 9 }
        ];
        
        legConfigs.forEach(leg => {
            const sideFactor = leg.side;
            const baseX = leg.xLoc;
            const baseY = leg.yLoc;
            const legSwing = Math.sin(crawl + leg.timeOffset) * 0.28;
            const legAngle = (sideFactor * (Math.PI / 2)) + leg.offsetAngle + (legSwing * sideFactor);
            
            const j1x = baseX + Math.cos(legAngle) * leg.len1;
            const j1y = baseY + Math.sin(legAngle) * leg.len1;
            
            const tibiaAngle = legAngle + (sideFactor * 0.7) - (legSwing * 0.15 * sideFactor);
            const j2x = j1x + Math.cos(tibiaAngle) * leg.len2;
            const j2y = j1y + Math.sin(tibiaAngle) * leg.len2;
            
            ctx.beginPath();
            ctx.moveTo(baseX, baseY);
            ctx.lineTo(j1x, j1y);
            ctx.lineTo(j2x, j2y);
            ctx.stroke();
        });

        // Antennae
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(0, -6); ctx.bezierCurveTo(-2, -9, -5, -11, -8, -12); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -6); ctx.bezierCurveTo(2, -9, 5, -11, 8, -12); ctx.stroke();

        // Mandibles
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(-1.5, -7.5, 2, Math.PI * 0.8, Math.PI * 1.6, false); ctx.stroke();
        ctx.beginPath(); ctx.arc(1.5, -7.5, 2, Math.PI * 1.4, Math.PI * 0.2, false); ctx.stroke();

        // Body segments
        // Abdomen
        ctx.beginPath();
        const abdomenGrad = ctx.createRadialGradient(-0.5, 5, 1, 0, 5, 5.5);
        abdomenGrad.addColorStop(0, '#e67e22');
        abdomenGrad.addColorStop(0.3, this.color);
        abdomenGrad.addColorStop(1, '#5c1d00');
        ctx.fillStyle = abdomenGrad;
        ctx.ellipse(0, 5, 3.5, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Petiole
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.ellipse(0, 0.5, 1, 1.2, 0, 0, Math.PI * 2); ctx.fill();

        // Thorax
        ctx.beginPath();
        const thoraxGrad = ctx.createRadialGradient(0, -2, 0.5, 0, -2, 2.5);
        thoraxGrad.addColorStop(0, '#f39c12');
        thoraxGrad.addColorStop(0.5, this.color);
        thoraxGrad.addColorStop(1, '#5c1d00');
        ctx.fillStyle = thoraxGrad;
        ctx.ellipse(0, -2, 2.3, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.beginPath();
        const headGrad = ctx.createRadialGradient(-0.5, -6.5, 0.5, 0, -6.5, 2.2);
        headGrad.addColorStop(0, '#e67e22');
        headGrad.addColorStop(0.5, this.color);
        headGrad.addColorStop(1, '#5c1d00');
        ctx.fillStyle = headGrad;
        ctx.ellipse(0, -6.5, 2.2, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#110500';
        ctx.beginPath();
        ctx.arc(-1.6, -7, 0.45, 0, Math.PI * 2);
        ctx.arc(1.6, -7, 0.45, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}

// Instantiate
window.addEventListener('load', () => {
    window.gameEngine = new GameSimulation();
});

/**
 * 💨 Visual Pixel-Art Wind Gust/Smoke Trail Actor
 * Snaps to the pixel grid and propagates in perfect sync with the grass & flower sways!
 */
class WindGust {
    constructor(y, game) {
        this.game = game;
        this.x = -350; // Start offscreen left
        this.y = y;    // Random height path
        this.speed = CONFIG.grass.windSpeed / CONFIG.grass.windWaveScale; // Sync speed: 2.2 / 0.006 = 366.6 px/s
        this.width = 250 + Math.random() * 150; // Width of the gust trail
        this.opacity = 0.09 + Math.random() * 0.13; // Translucent smoke-like mist
        this.life = 0;
        this.maxLife = (CONFIG.world.width + 500) / this.speed;
        
        // Dynamic segments of wavy smoke lines (perfectly green theme matching your pixel art!)
        this.lines = [];
        const numLines = 3 + Math.floor(Math.random() * 3);
        for (let l = 0; l < numLines; l++) {
            this.lines.push({
                dy: -25 + Math.random() * 50,
                length: 80 + Math.random() * 120,
                offsetX: Math.random() * 60,
                thickness: 2 + Math.floor(Math.random() * 2) // 2 to 3 retro-pixels thick
            });
        }
        
        // Float neon-green dust specs inside the wind gust
        this.dots = [];
        const numDots = 4 + Math.floor(Math.random() * 6);
        for (let d = 0; d < numDots; d++) {
            this.dots.push({
                dx: Math.random() * 250,
                dy: -35 + Math.random() * 70,
                size: 1 + Math.floor(Math.random() * 2), // 1 to 2 retro-pixels size
                color: Math.random() > 0.4 ? 'rgba(74, 185, 126, 0.4)' : 'rgba(46, 204, 113, 0.4)' // Bright neon specs
            });
        }
    }

    update(dt) {
        this.x += this.speed * dt;
        this.life += dt;
        
        // Slight vertical wavering drift
        this.y += Math.sin(this.life * 2.5) * 12 * dt;
    }

    render(ctx) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        
        const pixelSize = 3; // Snapped retro pixel size!
        
        // Translucent forest wind color (soft light-green smoke)
        ctx.fillStyle = `rgba(169, 223, 191, ${this.opacity})`;
        
        this.lines.forEach(line => {
            // Snap starting positions to retro pixel units
            const startRx = Math.round((this.x + line.offsetX) / pixelSize);
            const startRy = Math.round((this.y + line.dy) / pixelSize);
            const rLength = Math.round(line.length / pixelSize);
            
            for (let dx = 0; dx < rLength; dx++) {
                const rx = startRx + dx;
                
                // Wavy path in sync with wind formula, snapped to integer retro-pixel height steps!
                const waveY = Math.round(Math.sin((rx * pixelSize) * CONFIG.grass.windWaveScale * 2.5) * 2.2);
                const ry = startRy + waveY;
                
                const px = rx * pixelSize;
                const py = ry * pixelSize;
                
                // Draw a vertical column representing the line's thickness in retro-pixels
                ctx.fillRect(px, py, pixelSize, pixelSize * line.thickness);
            }
        });
        
        // Render the drifting specs, snapped to the exact same wave path!
        this.dots.forEach(dot => {
            const rx = Math.round((this.x + dot.dx) / pixelSize);
            const startRy = Math.round((this.y + dot.dy) / pixelSize);
            const waveY = Math.round(Math.sin((rx * pixelSize) * CONFIG.grass.windWaveScale * 2.5) * 2.2);
            const ry = startRy + waveY;
            
            const px = rx * pixelSize;
            const py = ry * pixelSize;
            
            ctx.fillStyle = dot.color;
            ctx.fillRect(px, py, pixelSize * dot.size, pixelSize * dot.size);
        });
        
        ctx.restore();
    }
}
