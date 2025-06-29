/**
 * @file Type definitions for Cubism 5 integration
 * @module cubism5/index
 */

import { LAppDelegate } from '@demo/lappdelegate.js';

/**
 * Custom subdelegate class for Canvas-related initialization and rendering management
 */
export declare class AppSubdelegate {
  /**
   * Initialize resources required by the application.
   * @param canvas The canvas object passed in
   * @returns True if initialization succeeded
   */
  initialize(canvas: HTMLCanvasElement): boolean;

  /**
   * Adjust and reinitialize the view when the canvas size changes
   */
  onResize(): void;

  /**
   * Main render loop, called periodically to update the screen
   */
  update(): void;

  /**
   * Get the canvas element
   */
  getCanvas(): HTMLCanvasElement;

  /**
   * Check if WebGL context is lost
   */
  isContextLost(): boolean;

  /**
   * Get the Live2D manager
   */
  getLive2DManager(): any;

  /**
   * Release resources
   */
  release(): void;
}

/**
 * Main application delegate class for managing the main loop, canvas, model switching, and other global logic
 */
export declare class AppDelegate extends LAppDelegate {
  /**
   * Initialize the application.
   * @returns True if initialization succeeded
   */
  initialize(): boolean;

  /**
   * Start the main loop.
   */
  run(): void;

  /**
   * Stop the main loop.
   */
  stop(): void;

  /**
   * Release all resources.
   */
  release(): void;

  /**
   * Transform mouse/touch coordinates to model coordinates
   * @param e Event object
   */
  transformOffset(e: any): { x: number; y: number };

  /**
   * Handle mouse move events
   * @param e Mouse event
   */
  onMouseMove(e: MouseEvent): void;

  /**
   * Handle mouse end events
   * @param e Mouse event
   */
  onMouseEnd(e: MouseEvent): void;

  /**
   * Handle tap events
   * @param e Mouse event
   */
  onTap(e: MouseEvent): void;

  /**
   * Initialize event listeners
   */
  initializeEventListener(): void;

  /**
   * Release event listeners
   */
  releaseEventListener(): void;

  /**
   * Initialize subdelegates
   */
  initializeSubdelegates(): void;

  /**
   * Switch model
   * @param modelSettingPath Path to the model setting file
   */
  changeModel(modelSettingPath: string): void;

  /**
   * Get subdelegates
   */
  get subdelegates(): any;

  /**
   * Initialize Cubism SDK
   */
  private initializeCubism(): void;

  // Properties
  _drawFrameId: number | null;
  _cubismOption: any;
  _subdelegates: any;
  mouseMoveEventListener: ((e: MouseEvent) => void) | null;
  mouseEndedEventListener: ((e: MouseEvent) => void) | null;
  tapEventListener: ((e: MouseEvent) => void) | null;
}
