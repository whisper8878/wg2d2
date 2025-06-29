/**
 * @file Contains classes related to waifu model loading and management.
 * @module model
 */

import type Cubism2Model from './cubism2/index.js';
import type { AppDelegate as Cubism5Model } from './cubism5/index.js';
import logger, { LogLevel } from './logger.js';
import { showMessage } from './message.js';
import { loadExternalResource, randomOtherOption } from './utils.js';

interface ModelListCDN {
  messages: string[];
  models: string | string[];
}

interface ModelList {
  name: string;
  paths: string[];
  message: string;
}

interface Config {
  /**
   * Path to the waifu configuration file.
   * @type {string}
   */
  waifuPath: string;
  /**
   * Path to the API, if you need to load models via API.
   * @type {string | undefined}
   */
  apiPath?: string;
  /**
   * Path to the CDN, if you need to load models via CDN.
   * @type {string | undefined}
   */
  cdnPath?: string;
  /**
   * Path to Cubism 2 Core, if you need to load Cubism 2 models.
   * @type {string | undefined}
   */
  cubism2Path?: string;
  /**
   * Path to Cubism 5 Core, if you need to load Cubism 3 and later models.
   * @type {string | undefined}
   */
  cubism5Path?: string;
  /**
   * Default model id.
   * @type {string | undefined}
   */
  modelId?: number;
  /**
   * List of tools to display.
   * @type {string[] | undefined}
   */
  tools?: string[];
  /**
   * Support for dragging the waifu.
   * @type {boolean | undefined}
   */
  drag?: boolean;
  /**
   * Log level.
   * @type {LogLevel | undefined}
   */
  logLevel?: LogLevel;
  /**
   * Custom model list.
   * @type {ModelList[] | undefined}
   */
  models?: ModelList[];
}

/**
 * Waifu model class, responsible for loading and managing models.
 */
class ModelManager {
  public readonly useCDN: boolean;
  private readonly cdnPath: string;
  private readonly cubism2Path: string;
  private readonly cubism5Path: string;
  private _modelId: number;
  private _modelTexturesId: number;
  private modelList: ModelListCDN | null = null;
  private cubism2model: Cubism2Model | undefined;
  private cubism5model: Cubism5Model | undefined;
  private currentModelVersion: number;
  private loading: boolean;
  private modelJSONCache: Record<string, any>;
  private models: ModelList[];

  /**
   * Create a Model instance.
   * @param {Config} config - Configuration options
   */
  private constructor(config: Config, models: ModelList[] = []) {
    let { apiPath, cdnPath } = config;
    const { cubism2Path, cubism5Path } = config;
    let useCDN = false;
    if (typeof cdnPath === 'string') {
      if (!cdnPath.endsWith('/')) cdnPath += '/';
      useCDN = true;
    } else if (typeof apiPath === 'string') {
      if (!apiPath.endsWith('/')) apiPath += '/';
      cdnPath = apiPath;
      useCDN = true;
      logger.warn('apiPath option is deprecated. Please use cdnPath instead.');
    } else if (!models.length) {
      throw 'Invalid initWidget argument!';
    }
    let modelId: number = parseInt(
      localStorage.getItem('modelId') as string,
      10,
    );
    let modelTexturesId: number = parseInt(
      localStorage.getItem('modelTexturesId') as string,
      10,
    );
    if (isNaN(modelId) || isNaN(modelTexturesId)) {
      modelTexturesId = 0;
    }
    if (isNaN(modelId)) {
      modelId = config.modelId ?? 0;
    }
    this.useCDN = useCDN;
    this.cdnPath = cdnPath || '';
    this.cubism2Path = cubism2Path || '';
    this.cubism5Path = cubism5Path || '';
    this._modelId = modelId;
    this._modelTexturesId = modelTexturesId;
    this.currentModelVersion = 0;
    this.loading = false;
    this.modelJSONCache = {};
    this.models = models;
  }

  public static async initCheck(config: Config, models: ModelList[] = []) {
    logger.info('🔧 ModelManager.initCheck 被调用:');
    logger.info(`  - config: ${JSON.stringify(config, null, 2)}`);
    logger.info(`  - models 数量: ${models.length}`);

    const model = new ModelManager(config, models);
    logger.info(`  - useCDN: ${model.useCDN}`);
    logger.info(`  - cdnPath: ${model.cdnPath}`);

    if (model.useCDN) {
      logger.info('📡 使用 CDN 模式，加载模型列表');
      const response = await fetch(`${model.cdnPath}model_list.json`);
      model.modelList = await response.json();
      if (model.modelId >= model.modelList.models.length) {
        model.modelId = 0;
      }
      const modelName = model.modelList.models[model.modelId];
      if (Array.isArray(modelName)) {
        if (model.modelTexturesId >= modelName.length) {
          model.modelTexturesId = 0;
        }
      } else {
        const modelSettingPath = `${model.cdnPath}model/${modelName}/index.json`;
        const modelSetting = await model.fetchWithCache(modelSettingPath);
        const version = model.checkModelVersion(modelSetting, modelSettingPath);
        if (version === 2) {
          const textureCache = await model.loadTextureCache(modelName);
          if (model.modelTexturesId >= textureCache.length) {
            model.modelTexturesId = 0;
          }
        }
      }
    } else {
      if (model.modelId >= model.models.length) {
        model.modelId = 0;
      }
      if (model.modelTexturesId >= model.models[model.modelId].paths.length) {
        model.modelTexturesId = 0;
      }
    }
    return model;
  }

  public set modelId(modelId: number) {
    this._modelId = modelId;
    localStorage.setItem('modelId', modelId.toString());
  }

  public get modelId() {
    return this._modelId;
  }

  public set modelTexturesId(modelTexturesId: number) {
    this._modelTexturesId = modelTexturesId;
    localStorage.setItem('modelTexturesId', modelTexturesId.toString());
  }

  public get modelTexturesId() {
    return this._modelTexturesId;
  }

  resetCanvas() {
    document.getElementById('waifu-canvas').innerHTML =
      '<canvas id="live2d" width="800" height="800"></canvas>';
  }

  async fetchWithCache(url: string) {
    let result;
    if (url in this.modelJSONCache) {
      result = this.modelJSONCache[url];
    } else {
      try {
        const response = await fetch(url);
        result = await response.json();
      } catch {
        result = null;
      }
      this.modelJSONCache[url] = result;
    }
    return result;
  }

  checkModelVersion(modelSetting: any, modelPath?: string) {
    logger.info('🔍 检查模型版本:');
    logger.info(`  - 模型路径: ${modelPath}`);
    logger.info(`  - 模型设置: ${JSON.stringify(modelSetting, null, 2)}`);

    // 如果有模型路径，先检查文件扩展名
    if (modelPath) {
      if (modelPath.includes('.model3.json')) {
        logger.info('  ✅ 通过文件扩展名检测到 Cubism 3+ 模型 (.model3.json)');
        return 3;
      }
      if (modelPath.includes('.model.json')) {
        logger.info('  ✅ 通过文件扩展名检测到 Cubism 2 模型 (.model.json)');
        return 2;
      }
    }

    // 检查模型设置内容
    if (modelSetting) {
      if (modelSetting.Version === 3 || modelSetting.FileReferences) {
        logger.info(
          `  ✅ 通过设置内容检测到 Cubism 3+ 模型 (Version=${
            modelSetting.Version
          }, FileReferences=${!!modelSetting.FileReferences})`,
        );
        return 3;
      }
      if (modelSetting.version || modelSetting.model) {
        logger.info(
          `  ✅ 通过设置内容检测到 Cubism 2 模型 (version=${
            modelSetting.version
          }, model=${!!modelSetting.model})`,
        );
        return 2;
      }
    }

    // 默认返回 3（Cubism 3+），使用 Cubism 5 SDK
    logger.info('  ⚠️ 无法确定模型版本，默认使用 Cubism 3+ (版本 3)');
    return 3;
  }

  async loadLive2D(modelSettingPath: string, modelSetting: object) {
    logger.info('🚀 开始加载 Live2D 模型:');
    logger.info(`  - 模型设置路径: ${modelSettingPath}`);
    logger.info(`  - 当前加载状态: ${this.loading}`);

    if (this.loading) {
      logger.warn('Still loading. Abort.');
      return;
    }
    this.loading = true;
    try {
      const version = this.checkModelVersion(modelSetting, modelSettingPath);
      logger.info(`📋 模型版本检测结果: ${version}`);

      if (version === 2) {
        logger.info('🎭 使用 Cubism 2 分支加载模型');
        logger.info(`  - cubism2Path: ${this.cubism2Path}`);
        logger.info(`  - cubism2model 存在: ${!!this.cubism2model}`);
        if (!this.cubism2model) {
          if (!this.cubism2Path) {
            logger.error('No cubism2Path set, cannot load Cubism 2 Core.');
            return;
          }
          await loadExternalResource(this.cubism2Path, 'js');
          const { default: Cubism2Model } = await import('./cubism2/index.js');
          this.cubism2model = new Cubism2Model();
        }
        if (this.currentModelVersion === 3) {
          (this.cubism5model as any).release();
          // Recycle WebGL resources
          this.resetCanvas();
        }
        if (this.currentModelVersion === 3 || !this.cubism2model.gl) {
          await this.cubism2model.init(
            'live2d',
            modelSettingPath,
            modelSetting,
          );
        } else {
          await this.cubism2model.changeModelWithJSON(
            modelSettingPath,
            modelSetting,
          );
        }
      } else {
        logger.info('🎭 使用 Cubism 5 分支加载模型');
        logger.info(`  - cubism5Path: ${this.cubism5Path}`);
        logger.info(`  - cubism5model 存在: ${!!this.cubism5model}`);

        if (!this.cubism5Path) {
          logger.error('No cubism5Path set, cannot load Cubism 5 Core.');
          return;
        }

        logger.info(`📦 加载 Cubism 5 Core: ${this.cubism5Path}`);
        await loadExternalResource(this.cubism5Path, 'js');

        logger.info('📦 导入 Cubism 5 模块');
        const { AppDelegate: Cubism5Model } = await import(
          './cubism5/index.js'
        );

        logger.info('🏗️ 创建 Cubism 5 模型实例');
        this.cubism5model = new (Cubism5Model as any)();

        if (this.currentModelVersion === 2) {
          logger.info('🔄 从 Cubism 2 切换到 Cubism 5，销毁旧模型');
          this.cubism2model.destroy();
          // Recycle WebGL resources
          this.resetCanvas();
        }

        const needsInitialization =
          this.currentModelVersion === 2 ||
          !this.cubism5model.subdelegates.at(0);
        logger.info(`🔧 是否需要初始化: ${needsInitialization}`);
        logger.info(`  - 当前模型版本: ${this.currentModelVersion}`);
        logger.info(
          `  - subdelegates 数量: ${
            this.cubism5model.subdelegates
              ? this.cubism5model.subdelegates.getSize()
              : 0
          }`,
        );

        if (needsInitialization) {
          logger.info('🚀 初始化 Cubism 5 模型');
          this.cubism5model.initialize();

          logger.info(`📂 更改模型: ${modelSettingPath}`);
          this.cubism5model.changeModel(modelSettingPath);

          logger.info('▶️ 启动渲染循环');
          this.cubism5model.run();
        } else {
          this.cubism5model.changeModel(modelSettingPath);
        }
      }
      logger.info(
        `Model ${modelSettingPath} (Cubism version ${version}) loaded`,
      );
      this.currentModelVersion = version;
    } catch (err) {
      console.error('loadLive2D failed', err);
    }
    this.loading = false;
  }

  async loadTextureCache(modelName: string): Promise<any[]> {
    const textureCache = await this.fetchWithCache(
      `${this.cdnPath}model/${modelName}/textures.cache`,
    );
    return textureCache || [];
  }

  /**
   * Load the specified model.
   * @param {string | string[]} message - Loading message.
   */
  async loadModel(message: string | string[]) {
    logger.info('🎯 loadModel 被调用:');
    logger.info(`  - message: ${JSON.stringify(message)}`);
    logger.info(`  - useCDN: ${this.useCDN}`);
    logger.info(`  - modelId: ${this.modelId}`);

    let modelSettingPath: any, modelSetting: any;
    if (this.useCDN) {
      let modelName = this.modelList.models[this.modelId];
      if (Array.isArray(modelName)) {
        modelName = modelName[this.modelTexturesId];
      }
      modelSettingPath = `${this.cdnPath}model/${modelName}/index.json`;
      modelSetting = await this.fetchWithCache(modelSettingPath);
      const version = this.checkModelVersion(modelSetting, modelSettingPath);
      if (version === 2) {
        const textureCache = await this.loadTextureCache(modelName);
        let textures = textureCache[this.modelTexturesId];
        if (typeof textures === 'string') textures = [textures];
        modelSetting.textures = textures;
      }
    } else {
      logger.info('📦 使用自定义模型模式');
      logger.info(`  - models 数组长度: ${this.models.length}`);
      logger.info(`  - 当前 modelId: ${this.modelId}`);
      logger.info(`  - 当前 modelTexturesId: ${this.modelTexturesId}`);

      if (this.models.length === 0) {
        logger.error('❌ 自定义模型数组为空！');
        return;
      }

      if (this.modelId >= this.models.length) {
        logger.warn(`⚠️ modelId (${this.modelId}) 超出范围，重置为 0`);
        this.modelId = 0;
      }

      const currentModel = this.models[this.modelId];
      logger.info(`  - 当前模型: ${JSON.stringify(currentModel, null, 2)}`);

      if (!currentModel.paths || currentModel.paths.length === 0) {
        logger.error('❌ 当前模型没有 paths 配置！');
        return;
      }

      if (this.modelTexturesId >= currentModel.paths.length) {
        logger.warn(
          `⚠️ modelTexturesId (${this.modelTexturesId}) 超出范围，重置为 0`,
        );
        this.modelTexturesId = 0;
      }

      modelSettingPath = currentModel.paths[this.modelTexturesId];
      logger.info(`  - 选择的模型路径: ${modelSettingPath}`);

      modelSetting = await this.fetchWithCache(modelSettingPath);
    }
    await this.loadLive2D(modelSettingPath, modelSetting);
    showMessage(message, 4000, 10);
  }

  /**
   * Load a random texture for the current model.
   */
  async loadRandTexture(
    successMessage: string | string[] = '',
    failMessage: string | string[] = '',
  ) {
    const { modelId } = this;
    let noTextureAvailable = false;
    if (this.useCDN) {
      const modelName = this.modelList.models[modelId];
      if (Array.isArray(modelName)) {
        this.modelTexturesId = randomOtherOption(
          modelName.length,
          this.modelTexturesId,
        );
      } else {
        const modelSettingPath = `${this.cdnPath}model/${modelName}/index.json`;
        const modelSetting = await this.fetchWithCache(modelSettingPath);
        const version = this.checkModelVersion(modelSetting, modelSettingPath);
        if (version === 2) {
          const textureCache = await this.loadTextureCache(modelName);
          if (textureCache.length <= 1) {
            noTextureAvailable = true;
          } else {
            this.modelTexturesId = randomOtherOption(
              textureCache.length,
              this.modelTexturesId,
            );
          }
        } else {
          noTextureAvailable = true;
        }
      }
    } else {
      if (this.models[modelId].paths.length === 1) {
        noTextureAvailable = true;
      } else {
        this.modelTexturesId = randomOtherOption(
          this.models[modelId].paths.length,
          this.modelTexturesId,
        );
      }
    }
    if (noTextureAvailable) {
      showMessage(failMessage, 4000, 10);
    } else {
      await this.loadModel(successMessage);
    }
  }

  /**
   * Load the next character's model.
   */
  async loadNextModel() {
    this.modelTexturesId = 0;
    if (this.useCDN) {
      this.modelId = (this.modelId + 1) % this.modelList.models.length;
      await this.loadModel(this.modelList.messages[this.modelId]);
    } else {
      this.modelId = (this.modelId + 1) % this.models.length;
      await this.loadModel(this.models[this.modelId].message);
    }
  }
}

export { Config, ModelList, ModelManager };
