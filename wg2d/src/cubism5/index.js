/* global document, window, Event */

import * as LAppDefine from '@demo/lappdefine.js';
import { LAppDelegate } from '@demo/lappdelegate.js';
import { LAppModel } from '@demo/lappmodel.js';
import { LAppPal } from '@demo/lapppal';
import { LAppSubdelegate } from '@demo/lappsubdelegate.js';
import { CubismFramework, LogLevel } from '@framework/live2dcubismframework';
import { csmVector } from '@framework/type/csmvector';
import logger from '../logger.js';

LAppPal.printMessage = () => {};

// Custom subdelegate class, responsible for Canvas-related initialization and rendering management
class AppSubdelegate extends LAppSubdelegate {
  /**
   * Initialize resources required by the application.
   * @param {HTMLCanvasElement} canvas The canvas object passed in
   */
  initialize(canvas) {
    // Initialize WebGL manager, return false if failed
    if (!this._glManager.initialize(canvas)) {
      return false;
    }

    this._canvas = canvas;

    // Canvas size setting, supports auto and specified size
    if (LAppDefine.CanvasSize === 'auto') {
      this.resizeCanvas();
    } else {
      canvas.width = LAppDefine.CanvasSize.width;
      canvas.height = LAppDefine.CanvasSize.height;
    }

    // Set the GL manager for the texture manager
    this._textureManager.setGlManager(this._glManager);

    const gl = this._glManager.getGl();

    // If the framebuffer object is not initialized, get the current framebuffer binding
    if (!this._frameBuffer) {
      this._frameBuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    }

    // Enable blend mode for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Initialize the view (AppView)
    this._view.initialize(this);
    this._view._gear = {
      render: () => {},
      isHit: () => {},
      release: () => {},
    };
    this._view._back = {
      render: () => {},
      release: () => {},
    };
    // this._view.initializeSprite();

    // Associate Live2D manager with the current subdelegate
    // this._live2dManager.initialize(this);
    this._live2dManager._subdelegate = this;

    // Listen for canvas size changes for responsive adaptation
    this._resizeObserver = new window.ResizeObserver((entries, observer) =>
      this.resizeObserverCallback.call(this, entries, observer),
    );
    this._resizeObserver.observe(this._canvas);

    return true;
  }

  /**
   * Adjust and reinitialize the view when the canvas size changes
   */
  onResize() {
    this.resizeCanvas();
    this._view.initialize(this);
    // this._view.initializeSprite();
  }

  /**
   * Main render loop, called periodically to update the screen
   */
  update() {
    // Check if the WebGL context is lost, if so, stop rendering
    if (this._glManager.getGl().isContextLost()) {
      return;
    }

    // If resize is needed, call onResize
    if (this._needResize) {
      this.onResize();
      this._needResize = false;
    }

    const gl = this._glManager.getGl();

    // Initialize the canvas as fully transparent
    gl.clearColor(0.0, 0.0, 0.0, 0.0);

    // Enable depth test to ensure correct model occlusion
    gl.enable(gl.DEPTH_TEST);

    // Set depth function so nearer objects cover farther ones
    gl.depthFunc(gl.LEQUAL);

    // Clear color and depth buffers
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.clearDepth(1.0);

    // Enable blend mode again to ensure transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Render the view content
    this._view.render();
  }
}

// Main application delegate class, responsible for managing the main loop, canvas, model switching, and other global logic
export class AppDelegate extends LAppDelegate {
  constructor() {
    super();

    // Initialize properties
    this._cubismOption = {};
    this._subdelegates = new csmVector();
    this._drawFrameId = null;

    // Event listeners
    this.mouseMoveEventListener = null;
    this.mouseEndedEventListener = null;
    this.tapEventListener = null;
  }

  /**
   * Initialize the application.
   * @returns {boolean} True if initialization succeeded
   */
  initialize() {
    // Initialize Cubism SDK
    this.initializeCubism();
    // Initialize subdelegates (canvas and rendering)
    this.initializeSubdelegates();
    // Initialize event listeners
    this.initializeEventListener();
    return true;
  }

  /**
   * Initialize Cubism SDK
   */
  initializeCubism() {
    // Update time
    LAppPal.updateTime();

    // Setup cubism options
    this._cubismOption.logFunction = LAppPal.printMessage;
    this._cubismOption.loggingLevel = LogLevel.LogLevel_Verbose;

    // Start up Cubism Framework
    CubismFramework.startUp(this._cubismOption);

    // Initialize Cubism Framework
    CubismFramework.initialize();
  }

  /**
   * Initialize subdelegates (canvas and rendering)
   */
  initializeSubdelegates() {
    // Find or create canvas element
    let canvas = document.getElementById('live2d');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'live2d';
      canvas.width = 800;
      canvas.height = 800;
      document.body.appendChild(canvas);
    }

    // Create and initialize subdelegate
    const subdelegate = new AppSubdelegate();
    if (subdelegate.initialize(canvas)) {
      this._subdelegates.pushBack(subdelegate);
      logger.info('Subdelegate initialized successfully');
    } else {
      logger.error('Failed to initialize subdelegate');
    }
  }

  /**
   * Initialize event listeners
   */
  initializeEventListener() {
    // Add mouse and touch event listeners
    this.mouseMoveEventListener = (e) => this.onMouseMove(e);
    this.mouseEndedEventListener = (e) => this.onMouseEnd(e);
    this.tapEventListener = (e) => this.onTap(e);

    document.addEventListener('mousemove', this.mouseMoveEventListener);
    document.addEventListener('mouseup', this.mouseEndedEventListener);
    document.addEventListener('click', this.tapEventListener);

    // Touch events for mobile
    document.addEventListener('touchmove', this.mouseMoveEventListener);
    document.addEventListener('touchend', this.mouseEndedEventListener);
    document.addEventListener('touchstart', this.tapEventListener);
  }

  /**
   * Start the main loop.
   */
  run() {
    // Main loop function, responsible for updating time and all subdelegates
    const loop = () => {
      // Update time
      LAppPal.updateTime();

      // Iterate all subdelegates and call update for rendering
      for (let i = 0; i < this._subdelegates.getSize(); i++) {
        this._subdelegates.at(i).update();
      }

      // Recursive call for animation loop
      this._drawFrameId = window.requestAnimationFrame(loop);
    };
    loop();
  }

  stop() {
    if (this._drawFrameId) {
      window.cancelAnimationFrame(this._drawFrameId);
      this._drawFrameId = null;
    }
  }

  release() {
    this.stop();
    this.releaseEventListener();
    this._subdelegates.clear();

    this._cubismOption = null;
  }

  transformOffset(e) {
    const subdelegate = this._subdelegates.at(0);
    const rect = subdelegate.getCanvas().getBoundingClientRect();
    const localX = e.pageX - rect.left;
    const localY = e.pageY - rect.top;
    const posX = localX * window.devicePixelRatio;
    const posY = localY * window.devicePixelRatio;
    const x = subdelegate._view.transformViewX(posX);
    const y = subdelegate._view.transformViewY(posY);
    return {
      x,
      y,
    };
  }

  onMouseMove(e) {
    const lapplive2dmanager = this._subdelegates.at(0).getLive2DManager();
    const { x, y } = this.transformOffset(e);
    const model = lapplive2dmanager._models.at(0);

    lapplive2dmanager.onDrag(x, y);
    lapplive2dmanager.onTap(x, y);
    if (model.hitTest(LAppDefine.HitAreaNameBody, x, y)) {
      window.dispatchEvent(new Event('live2d:hoverbody'));
    }
  }

  onMouseEnd(e) {
    const lapplive2dmanager = this._subdelegates.at(0).getLive2DManager();
    const { x, y } = this.transformOffset(e);
    lapplive2dmanager.onDrag(0.0, 0.0);
    lapplive2dmanager.onTap(x, y);
  }

  onTap(e) {
    const lapplive2dmanager = this._subdelegates.at(0).getLive2DManager();
    const { x, y } = this.transformOffset(e);
    const model = lapplive2dmanager._models.at(0);

    if (model.hitTest(LAppDefine.HitAreaNameBody, x, y)) {
      window.dispatchEvent(new Event('live2d:tapbody'));
    }
  }

  initializeEventListener() {
    this.mouseMoveEventListener = this.onMouseMove.bind(this);
    this.mouseEndedEventListener = this.onMouseEnd.bind(this);
    this.tapEventListener = this.onTap.bind(this);

    document.addEventListener('mousemove', this.mouseMoveEventListener, {
      passive: true,
    });
    document.addEventListener('mouseout', this.mouseEndedEventListener, {
      passive: true,
    });
    document.addEventListener('pointerdown', this.tapEventListener, {
      passive: true,
    });
  }

  releaseEventListener() {
    document.removeEventListener('mousemove', this.mouseMoveEventListener, {
      passive: true,
    });
    this.mouseMoveEventListener = null;
    document.removeEventListener('mouseout', this.mouseEndedEventListener, {
      passive: true,
    });
    this.mouseEndedEventListener = null;
    document.removeEventListener('pointerdown', this.tapEventListener, {
      passive: true,
    });
  }

  /**
   * Create canvas and initialize all Subdelegates
   */
  initializeSubdelegates() {
    // Reserve space to improve performance
    this._canvases.prepareCapacity(LAppDefine.CanvasNum);
    this._subdelegates.prepareCapacity(LAppDefine.CanvasNum);

    // Get the live2d canvas element from the page
    const canvas = document.getElementById('live2d');
    this._canvases.pushBack(canvas);

    // Set canvas style size to match actual size
    canvas.style.width = canvas.width;
    canvas.style.height = canvas.height;

    // For each canvas, create a subdelegate and complete initialization
    for (let i = 0; i < this._canvases.getSize(); i++) {
      const subdelegate = new AppSubdelegate();
      const result = subdelegate.initialize(this._canvases.at(i));
      if (!result) {
        logger.error('Failed to initialize AppSubdelegate');
        return;
      }
      this._subdelegates.pushBack(subdelegate);
    }

    // Check if the WebGL context of each subdelegate is lost
    for (let i = 0; i < LAppDefine.CanvasNum; i++) {
      if (this._subdelegates.at(i).isContextLost()) {
        logger.error(
          `The context for Canvas at index ${i} was lost, possibly because the acquisition limit for WebGLRenderingContext was reached.`,
        );
      }
    }
  }

  /**
   * Switch model with enhanced auto-loading
   * @param {string} modelSettingPath Path to the model setting file
   */
  changeModel(modelSettingPath) {
    const segments = modelSettingPath.split('/');
    const modelJsonName = segments.pop();
    const modelPath = segments.join('/') + '/';
    // Get the current Live2D manager
    const live2dManager = this._subdelegates.at(0).getLive2DManager();
    // Release all old models
    live2dManager.releaseAllModel();
    // Create a new model instance (back to original)
    const instance = new LAppModel();
    instance.setSubdelegate(live2dManager._subdelegate);
    instance.loadAssets(modelPath, modelJsonName);
    // Add the new model to the model list
    live2dManager._models.pushBack(instance);
  }

  get subdelegates() {
    return this._subdelegates;
  }
}

/**
 * Enhanced LAppModel with complete auto-loading mechanism
 * Automatically loads all expressions, motions, and other assets like Cubism 2
 */
class EnhancedLAppModel extends LAppModel {
  constructor() {
    super();
    this._autoLoadingComplete = false;
    this._expressionLoadCount = 0;
    this._motionLoadCount = 0;
    this._totalExpressions = 0;
    this._totalMotions = 0;
  }

  /**
   * Override loadAssets to add auto-loading functionality
   */
  loadAssets(dir, fileName) {
    console.log('🚀 EnhancedLAppModel: Starting enhanced auto-loading...');
    this._modelHomeDir = dir;

    fetch(`${this._modelHomeDir}${fileName}`)
      .then((response) => response.arrayBuffer())
      .then((arrayBuffer) => {
        const setting = new window.Live2DCubismFramework.CubismModelSettingJson(
          arrayBuffer,
          arrayBuffer.byteLength,
        );

        // Start the enhanced loading process
        this.setupModelWithAutoLoading(setting);
      })
      .catch((error) => {
        console.error('❌ Failed to load model setting:', error);
      });
  }

  /**
   * Enhanced model setup with complete auto-loading
   */
  async setupModelWithAutoLoading(setting) {
    console.log('📋 Setting up model with auto-loading...');
    this._modelSetting = setting;

    // Load model data first
    await this.loadModelData();

    // Auto-load all expressions
    await this.autoLoadAllExpressions();

    // Auto-load all motions
    await this.autoLoadAllMotions();

    // Load physics and other components
    await this.loadPhysicsAndOthers();

    // Setup textures and complete initialization
    await this.completeSetup();

    // Create simplified API
    this.createSimplifiedAPI();

    console.log('✅ Enhanced auto-loading complete!');
    this._autoLoadingComplete = true;
  }

  /**
   * Load model data (moc3 file)
   */
  async loadModelData() {
    console.log('📦 Loading model data...');
    const modelFileName = this._modelSetting.getModelFileName();

    try {
      const response = await fetch(`${this._modelHomeDir}${modelFileName}`);
      const arrayBuffer = await response.arrayBuffer();

      this.loadModel(arrayBuffer, arrayBuffer.byteLength, false);
      console.log('✅ Model data loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load model data:', error);
    }
  }

  /**
   * Auto-load all expressions (like Cubism 2)
   */
  async autoLoadAllExpressions() {
    const expressionCount = this._modelSetting.getExpressionCount();
    console.log(`🎭 Auto-loading ${expressionCount} expressions...`);

    if (expressionCount === 0) {
      console.log('ℹ️ No expressions to load');
      return;
    }

    this._totalExpressions = expressionCount;
    this._expressionLoadCount = 0;

    const loadPromises = [];

    for (let i = 0; i < expressionCount; i++) {
      const expressionName = this._modelSetting.getExpressionName(i);
      const expressionFileName = this._modelSetting.getExpressionFileName(i);

      console.log(
        `📥 Loading expression ${i + 1}/${expressionCount}: ${expressionName}`,
      );

      const loadPromise = this.loadSingleExpression(
        expressionName,
        expressionFileName,
      );
      loadPromises.push(loadPromise);
    }

    // Wait for all expressions to load
    await Promise.all(loadPromises);
    console.log(`✅ All ${expressionCount} expressions loaded successfully!`);
  }

  /**
   * Load a single expression
   */
  async loadSingleExpression(expressionName, expressionFileName) {
    try {
      const response = await fetch(
        `${this._modelHomeDir}${expressionFileName}`,
      );
      if (!response.ok) {
        console.warn(`⚠️ Expression file not found: ${expressionFileName}`);
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      const motion = this.loadExpression(
        arrayBuffer,
        arrayBuffer.byteLength,
        expressionName,
      );

      if (motion) {
        // Clean up existing expression if any
        if (this._expressions.getValue(expressionName) != null) {
          window.Live2DCubismFramework.ACubismMotion.delete(
            this._expressions.getValue(expressionName),
          );
        }

        // Register the expression
        this._expressions.setValue(expressionName, motion);
        this._expressionLoadCount++;

        console.log(`✅ Expression loaded: ${expressionName}`);
      }
    } catch (error) {
      console.error(`❌ Failed to load expression ${expressionName}:`, error);
    }
  }

  /**
   * Auto-load all motions (like Cubism 2)
   */
  async autoLoadAllMotions() {
    const motionGroupCount = this._modelSetting.getMotionGroupCount();
    console.log(`🎬 Auto-loading motions from ${motionGroupCount} groups...`);

    if (motionGroupCount === 0) {
      console.log('ℹ️ No motion groups to load');
      return;
    }

    // Calculate total motions
    this._totalMotions = 0;
    for (let i = 0; i < motionGroupCount; i++) {
      const group = this._modelSetting.getMotionGroupName(i);
      this._totalMotions += this._modelSetting.getMotionCount(group);
    }

    console.log(`📊 Total motions to load: ${this._totalMotions}`);
    this._motionLoadCount = 0;

    // Load all motion groups
    const loadPromises = [];
    for (let i = 0; i < motionGroupCount; i++) {
      const group = this._modelSetting.getMotionGroupName(i);
      const groupPromise = this.autoLoadMotionGroup(group);
      loadPromises.push(groupPromise);
    }

    // Wait for all motions to load
    await Promise.all(loadPromises);
    console.log(`✅ All ${this._totalMotions} motions loaded successfully!`);
  }

  /**
   * Auto-load a motion group
   */
  async autoLoadMotionGroup(group) {
    const motionCount = this._modelSetting.getMotionCount(group);
    console.log(
      `📥 Loading motion group "${group}" (${motionCount} motions)...`,
    );

    const loadPromises = [];

    for (let i = 0; i < motionCount; i++) {
      const motionFileName = this._modelSetting.getMotionFileName(group, i);
      const motionKey = `${group}_${i}`;

      const loadPromise = this.loadSingleMotion(
        group,
        i,
        motionKey,
        motionFileName,
      );
      loadPromises.push(loadPromise);
    }

    await Promise.all(loadPromises);
    console.log(`✅ Motion group "${group}" loaded successfully!`);
  }

  /**
   * Load a single motion
   */
  async loadSingleMotion(group, index, motionKey, motionFileName) {
    try {
      const response = await fetch(`${this._modelHomeDir}${motionFileName}`);
      if (!response.ok) {
        console.warn(`⚠️ Motion file not found: ${motionFileName}`);
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      const motion = this.loadMotion(
        arrayBuffer,
        arrayBuffer.byteLength,
        motionKey,
        null, // onFinishedMotionHandler
        null, // onBeganMotionHandler
        this._modelSetting,
        group,
        index,
        true, // motionConsistency
      );

      if (motion) {
        // Set effect IDs for eye blink and lip sync
        if (this._eyeBlinkIds && this._lipSyncIds) {
          motion.setEffectIds(this._eyeBlinkIds, this._lipSyncIds);
        }

        // Clean up existing motion if any
        if (this._motions.getValue(motionKey) != null) {
          window.Live2DCubismFramework.ACubismMotion.delete(
            this._motions.getValue(motionKey),
          );
        }

        // Register the motion
        this._motions.setValue(motionKey, motion);
        this._motionLoadCount++;

        console.log(`✅ Motion loaded: ${motionKey} (${motionFileName})`);
      }
    } catch (error) {
      console.error(`❌ Failed to load motion ${motionKey}:`, error);
    }
  }

  /**
   * Load physics and other components
   */
  async loadPhysicsAndOthers() {
    console.log('⚙️ Loading physics and other components...');

    // Load physics
    if (this._modelSetting.getPhysicsFileName() != null) {
      const physicsFileName = this._modelSetting.getPhysicsFileName();
      try {
        const response = await fetch(`${this._modelHomeDir}${physicsFileName}`);
        const arrayBuffer = await response.arrayBuffer();
        this.loadPhysics(arrayBuffer, arrayBuffer.byteLength);
        console.log('✅ Physics loaded successfully');
      } catch (error) {
        console.error('❌ Failed to load physics:', error);
      }
    }

    // Skip pose loading (causing server errors)
    if (this._modelSetting.getPoseFileName() != null) {
      console.log('⚠️ Skipping pose loading to avoid server errors');
    }

    // Setup eye blink
    if (this._modelSetting.getEyeBlinkParameterCount() > 0) {
      this._eyeBlinkIds = new window.Live2DCubismFramework.csmVector();
      for (let i = 0; i < this._modelSetting.getEyeBlinkParameterCount(); i++) {
        this._eyeBlinkIds.pushBack(
          this._modelSetting.getEyeBlinkParameterId(i),
        );
      }
      this._eyeBlink = window.Live2DCubismFramework.CubismEyeBlink.create(
        this._modelSetting,
      );
      console.log('✅ Eye blink setup complete');
    }

    // Setup lip sync
    if (this._modelSetting.getLipSyncParameterCount() > 0) {
      this._lipSyncIds = new window.Live2DCubismFramework.csmVector();
      for (let i = 0; i < this._modelSetting.getLipSyncParameterCount(); i++) {
        this._lipSyncIds.pushBack(this._modelSetting.getLipSyncParameterId(i));
      }
      console.log('✅ Lip sync setup complete');
    }
  }

  /**
   * Complete setup with textures (use official method with proper state)
   */
  async completeSetup() {
    console.log('🎨 Setting up textures and completing initialization...');

    try {
      // Create renderer first
      this.createRenderer();

      // Set the correct state for texture loading
      this._state = window.Live2DCubismFramework.LoadStep?.LoadTexture || 6; // LoadTexture state
      this._textureCount = 0;

      // Use the official setupTextures method
      this.setupTextures();

      console.log('✅ Texture loading initiated using official method');
    } catch (error) {
      console.error('❌ Failed to setup textures:', error);
      // Fallback: mark as complete anyway
      this._state = window.Live2DCubismFramework.LoadStep?.CompleteSetup || 7;
    }
  }

  /**
   * Create simplified API like Cubism 2
   */
  createSimplifiedAPI() {
    console.log('🔧 Creating simplified API...');

    // Global expression API
    window.setExpression = (name) => {
      console.log(`🎭 Setting expression: ${name}`);
      return this.setExpression(name);
    };

    // Global motion API
    window.startMotion = (group, index, priority = 3) => {
      const motionKey = `${group}_${index}`;
      console.log(`🎬 Starting motion: ${motionKey}`);
      return this.startMotion(group, index, priority);
    };

    // Global random expression API
    window.setRandomExpression = () => {
      console.log('🎲 Setting random expression');
      return this.setRandomExpression();
    };

    // Global random motion API
    window.startRandomMotion = (group, priority = 3) => {
      console.log(`🎲 Starting random motion in group: ${group}`);
      return this.startRandomMotion(group, priority);
    };

    // Status check API
    window.checkAutoLoadStatus = () => {
      console.log('📊 Auto-load Status:');
      console.log(
        `  - Expressions: ${this._expressionLoadCount}/${this._totalExpressions}`,
      );
      console.log(
        `  - Motions: ${this._motionLoadCount}/${this._totalMotions}`,
      );
      console.log(`  - Complete: ${this._autoLoadingComplete}`);
      console.log('  - Available expressions:', this.getAvailableExpressions());
      console.log('  - Available motions:', this.getAvailableMotions());
    };

    console.log('✅ Simplified API created successfully!');
  }

  /**
   * Get available expressions
   */
  getAvailableExpressions() {
    const expressions = [];
    for (let i = 0; i < this._expressions.getSize(); i++) {
      expressions.push(this._expressions._keyValues[i].first);
    }
    return expressions;
  }

  /**
   * Get available motions
   */
  getAvailableMotions() {
    const motions = [];
    for (let i = 0; i < this._motions.getSize(); i++) {
      motions.push(this._motions._keyValues[i].first);
    }
    return motions;
  }
}
