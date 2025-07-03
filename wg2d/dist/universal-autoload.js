/*!
 * Live2D Widget - 通用模型加载脚本
 * 基于 live2d-widget 项目
 */

// 使用本地路径和CDN路径
const live2d_path =
  'https://cdn.jsdelivr.net/gh/whisper8878/wg2d2@c26cd8784bda531cd8e41420be786af89bae7592/wg2d/dist/';
const CDN_BASE =
  'https://raw.githubusercontent.com/whisper8878/model2/master/model/';

// 缓存避免系统
const CacheManager = {
  // 生成时间戳哈希
  generateTimestampHash() {
    return Date.now().toString(36);
  },

  // 生成随机哈希
  generateRandomHash() {
    return Math.random().toString(36).substring(2, 15);
  },

  // 添加缓存避免参数到URL
  addCacheBuster(url, useTimestamp = true) {
    const separator = url.includes('?') ? '&' : '?';
    const hash = useTimestamp
      ? this.generateTimestampHash()
      : this.generateRandomHash();
    return `${url}${separator}v=${hash}&_=${Date.now()}`;
  },

  // 为模型配置添加缓存避免
  addCacheBusterToModelConfig(config) {
    if (config.paths && Array.isArray(config.paths)) {
      config.paths = config.paths.map((path) => this.addCacheBuster(path));
    }
    return config;
  },
};

// 懒加载模型发现系统
const ModelDiscovery = {
  // 已知模型配置 - 只保留高质量无水印的模型
  knownModels: {
    ariu: {
      name: 'Ariu',
      message: 'Ariu模型加载成功！',
      paths: [`${CDN_BASE}ariu/ariu.model3.json`],
      globalVar: 'ariuModel',
      description: '虚拟主播风格的Live2D模型',
    },
    xiaoeemo: {
      name: '小恶魔',
      message: '小恶魔模型加载成功！',
      paths: [`${CDN_BASE}xiaoeemo/xiaoeemo.model3.json`],
      globalVar: 'xiaoeemoModel',
      description: '可爱的小恶魔风格模型',
    },
    march7th: {
      name: '三月七',
      message: '三月七模型加载成功！',
      paths: [`${CDN_BASE}March 7th/march 7th.model3.json`],
      globalVar: 'march7thModel',
      description: '崩坏：星穹铁道角色三月七',
    },
    nicole: {
      name: '妮可',
      message: '妮可模型加载成功！',
      paths: [`${CDN_BASE}Nicole/Nicole.model3.json`],
      globalVar: 'nicoleModel',
      description: '绝区零角色妮可',
    },
    chun: {
      name: '椿',
      message: '椿模型加载成功！',
      paths: [`${CDN_BASE}chun/chun.model3.json`],
      globalVar: 'chunModel',
      description: '椿角色模型',
    },
    fuxuan: {
      name: '符玄',
      message: '符玄模型加载成功！',
      paths: [`${CDN_BASE}fuxuan/fuxuan.model3.json`],
      globalVar: 'fuxuanModel',
      description: '崩坏：星穹铁道角色符玄',
    },
    huohuo: {
      name: '藿藿',
      message: '藿藿模型加载成功！',
      paths: [`${CDN_BASE}huohuo/huohuo.model3.json`],
      globalVar: 'huohuoModel',
      description: '崩坏：星穹铁道角色藿藿',
    },
    monv: {
      name: '魔女',
      message: '魔女模型加载成功！',
      paths: [`${CDN_BASE}monv/monv.model3.json`],
      globalVar: 'monvModel',
      description: '魔女角色模型',
    },
    tingyun: {
      name: '停云',
      message: '停云模型加载成功！',
      paths: [`${CDN_BASE}tingyun/tingyun.model3.json`],
      globalVar: 'tingyunModel',
      description: '崩坏：星穹铁道角色停云',
    },
  },
  // 动态发现的模型缓存
  discoveredModels: {},

  // 发现状态跟踪
  discoveryState: {
    isDiscovering: false,
    hasDiscovered: false,
    lastDiscoveryTime: 0,
    discoveryCache: new Map(), // 缓存检测结果
  },

  // 当前活动模型
  currentModel: null,

  // GitHub API 模型探索器 - 实验性功能
  async exploreGitHubRepo() {
    try {
      //console.log('🔍 尝试通过GitHub API探索模型库...');

      // 注意：GitHub API 有速率限制，这里只是示例
      const apiUrl =
        'https://api.github.com/repos/whisper8878/model2/contents/model';

      const response = await fetch(apiUrl, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Live2D-Model-Explorer',
        },
      });

      if (response.ok) {
        const contents = await response.json();
        const modelFolders = contents
          .filter((item) => item.type === 'dir')
          .map((item) => item.name);

        //console.log(
        //  `📁 GitHub API 发现 ${modelFolders.length} 个模型文件夹:`,
        //  modelFolders,
        //);
        return modelFolders;
      }
    } catch (error) {
      console.warn('⚠️ GitHub API 探索失败:', error.message);
    }

    return [];
  },

  // 懒加载模型发现 - 只在需要时检测
  async discoverModelsLazy(requestedModel = null) {
    // 如果请求的是已知模型，直接返回
    if (requestedModel && this.knownModels[requestedModel]) {
      //console.log(`✅ 模型 ${requestedModel} 已在预配置列表中`);
      return { [requestedModel]: this.knownModels[requestedModel] };
    }

    // 检查缓存
    if (
      requestedModel &&
      this.discoveryState.discoveryCache.has(requestedModel)
    ) {
      const cached = this.discoveryState.discoveryCache.get(requestedModel);
      //console.log(`📋 从缓存获取模型: ${requestedModel}`);
      return cached.exists ? { [requestedModel]: cached.config } : {};
    }

    //console.log(`🔍 懒加载检测模型: ${requestedModel || '所有模型'}...`);

    // 如果正在发现中，等待完成
    if (this.discoveryState.isDiscovering) {
      //console.log('⏳ 模型发现正在进行中，请稍候...');
      return {};
    }

    this.discoveryState.isDiscovering = true;

    try {
      // 如果指定了模型，只检测该模型
      if (requestedModel) {
        const result = await this.checkSingleModel(requestedModel);
        this.discoveryState.isDiscovering = false;
        return result;
      }

      // 否则提示用户使用完整发现
      //console.log('💡 提示：使用 discoverAllModels() 来发现所有可用模型');
      this.discoveryState.isDiscovering = false;
      return {};
    } catch (error) {
      console.error('❌ 懒加载发现出错:', error);
      this.discoveryState.isDiscovering = false;
      return {};
    }
  },

  // 检测单个模型
  async checkSingleModel(modelName) {
    try {
      // 尝试多种可能的模型文件名格式
      const possiblePaths = [
        `${CDN_BASE}${modelName}/${modelName}.model3.json`,
        `${CDN_BASE}${modelName.replace(/\s+/g, '')}/${modelName.replace(
          /\s+/g,
          '',
        )}.model3.json`,
        `${CDN_BASE}${modelName.replace(/\s+/g, '_')}/${modelName.replace(
          /\s+/g,
          '_',
        )}.model3.json`,
        `${CDN_BASE}${modelName.replace(/\s+/g, '-')}/${modelName.replace(
          /\s+/g,
          '-',
        )}.model3.json`,
      ];

      for (const modelUrl of possiblePaths) {
        try {
          //console.log(`🔍 检测模型路径: ${modelUrl}`);

          const response = await fetch(modelUrl, {
            method: 'HEAD',
            headers: {
              'Cache-Control': 'no-cache',
            },
          });

          if (response.ok) {
            //console.log(`✅ 发现模型: ${modelName}`);
            const normalizedName = modelName.replace(/\s+/g, '').toLowerCase();
            const config = {
              name: this.formatModelName(modelName),
              message: `${this.formatModelName(modelName)}模型加载成功！`,
              paths: [modelUrl],
              globalVar: `${normalizedName}Model`,
              description: `动态发现的${this.formatModelName(modelName)}模型`,
              discovered: true,
              originalName: modelName,
            };

            // 缓存结果
            this.discoveryState.discoveryCache.set(modelName, {
              exists: true,
              config,
            });
            this.discoveredModels[normalizedName] = config;

            return { [normalizedName]: config };
          }
        } catch (pathError) {
          // 继续尝试下一个路径
        }
      }

      // 模型不存在，缓存负结果
      this.discoveryState.discoveryCache.set(modelName, { exists: false });
      console.log(`❌ 模型不存在: ${modelName}`);
      return {};
    } catch (error) {
      console.error(`❌ 检测模型 ${modelName} 时出错:`, error);
      return {};
    }
  },

  // 完整的模型发现（按需调用）
  async discoverAllModels() {
    if (
      this.discoveryState.hasDiscovered &&
      Date.now() - this.discoveryState.lastDiscoveryTime < 300000
    ) {
      //console.log('📋 使用缓存的发现结果（5分钟内有效）');
      return this.discoveredModels;
    }

    //console.log('🔍 开始完整模型发现...');
    this.discoveryState.isDiscovering = true;

    try {
      // 尝试通过 GitHub API 获取最新模型列表
      const githubModels = await this.exploreGitHubRepo();

      // 基于实际assets的模型列表
      const potentialModels = [
        // 从assets目录确认存在的模型
        'March 7th',
        'Nicole',
        'Sparkle',
        'ailian',
        'ariu',
        'bingtang',
        'chun',
        'funingna',
        'fuxuan',
        'huohuo',
        'monv',
        'tingyun',
        'xiaoeemo',
        'xiaoxiong',

        // GitHub API 发现的模型
        ...githubModels,
      ];

      // 去重处理
      const uniqueModels = [...new Set(potentialModels)];

      // 批量检测
      const batchSize = 3; // 减少并发数量
      const modelBatches = [];

      for (let i = 0; i < uniqueModels.length; i += batchSize) {
        modelBatches.push(uniqueModels.slice(i, i + batchSize));
      }

      let discoveredCount = 0;

      for (const batch of modelBatches) {
        const batchPromises = batch.map(async (modelName) => {
          const result = await this.checkSingleModel(modelName);
          if (Object.keys(result).length > 0) {
            discoveredCount++;
          }
        });

        await Promise.allSettled(batchPromises);

        // 添加批次间的延迟
        if (modelBatches.indexOf(batch) < modelBatches.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      this.discoveryState.hasDiscovered = true;
      this.discoveryState.lastDiscoveryTime = Date.now();
      this.discoveryState.isDiscovering = false;

      //console.log(`🎯 完整模型发现完成! 发现了 ${discoveredCount} 个新模型`);
      return this.discoveredModels;
    } catch (error) {
      console.error('❌ 完整模型发现出错:', error);
      this.discoveryState.isDiscovering = false;
      return {};
    }
  },

  // 动态发现模型的方法（保持兼容性，但改为调用完整发现）
  async discoverModels() {
    //console.log('🔍 开始动态发现模型...');

    // 尝试通过 GitHub API 获取最新模型列表
    const githubModels = await this.exploreGitHubRepo();

    // 基于实际assets目录的模型列表（避免无效检测）
    const potentialModels = [
      // 从assets目录确认存在的模型
      'March 7th',
      'Nicole',
      'Sparkle',
      'ailian',
      'ariu',
      'bingtang',
      'chun',
      'funingna',
      'fuxuan',
      'huohuo',
      'monv',
      'tingyun',
      'xiaoeemo',
      'xiaoxiong',

      // GitHub API 发现的模型
      ...githubModels,
    ];

    // 去重处理
    const uniqueModels = [...new Set(potentialModels)]; // 使用并发检测提高效率
    const batchSize = 5; // 每批检测5个模型
    const modelBatches = [];

    for (let i = 0; i < uniqueModels.length; i += batchSize) {
      modelBatches.push(uniqueModels.slice(i, i + batchSize));
    }

    let discoveredCount = 0;

    for (const batch of modelBatches) {
      const batchPromises = batch.map(async (modelName) => {
        try {
          // 尝试多种可能的模型文件名格式
          const possiblePaths = [
            `${CDN_BASE}${modelName}/${modelName}.model3.json`,
            `${CDN_BASE}${modelName.replace(/\s+/g, '')}/${modelName.replace(
              /\s+/g,
              '',
            )}.model3.json`,
            `${CDN_BASE}${modelName.replace(/\s+/g, '_')}/${modelName.replace(
              /\s+/g,
              '_',
            )}.model3.json`,
            `${CDN_BASE}${modelName.replace(/\s+/g, '-')}/${modelName.replace(
              /\s+/g,
              '-',
            )}.model3.json`,
          ];

          for (const modelUrl of possiblePaths) {
            try {
              //console.log(`🔍 检测模型: ${modelName} - ${modelUrl}`);

              const response = await fetch(modelUrl, {
                method: 'HEAD',
                headers: {
                  'Cache-Control': 'no-cache',
                },
              });

              if (response.ok) {
                //console.log(`✅ 发现模型: ${modelName}`);
                const normalizedName = modelName
                  .replace(/\s+/g, '')
                  .toLowerCase();
                this.discoveredModels[normalizedName] = {
                  name: this.formatModelName(modelName),
                  message: `${this.formatModelName(modelName)}模型加载成功！`,
                  paths: [modelUrl],
                  globalVar: `${normalizedName}Model`,
                  description: `动态发现的${this.formatModelName(
                    modelName,
                  )}模型`,
                  discovered: true,
                  originalName: modelName,
                };
                discoveredCount++;
                break; // 找到一个有效路径就停止
              }
            } catch (pathError) {
              // 继续尝试下一个路径
            }
          }
        } catch (error) {
          // 静默处理错误，继续检测下一个模型
        }
      });

      // 等待当前批次完成
      await Promise.allSettled(batchPromises);

      // 添加批次间的延迟，避免请求过于频繁
      if (modelBatches.indexOf(batch) < modelBatches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    //console.log(`🎯 模型发现完成! 发现了 ${discoveredCount} 个新模型`);
    return this.discoveredModels;
  }, // 格式化模型名称
  formatModelName(modelName) {
    // 直接返回首字母大写的形式，保持原始名称
    return modelName.charAt(0).toUpperCase() + modelName.slice(1);
  },

  // 获取所有可用模型
  getAllModels() {
    return { ...this.knownModels, ...this.discoveredModels };
  },

  // 获取模型配置
  getModelConfig(modelId) {
    const allModels = this.getAllModels();
    return allModels[modelId] || null;
  },

  // 列出所有模型
  listAllModels() {
    const allModels = this.getAllModels();
    //console.log('📋 所有可用模型:');
    Object.entries(allModels).forEach(([id, config]) => {
      const source = config.discovered ? '(动态发现)' : '(预配置)';
      //console.log(
      //  `  - ${id}: ${config.name} ${source} - ${config.description}`,
      //);
    });
    return allModels;
  },

  // 切换模型（支持懒加载）
  async switchModel(modelId) {
    let modelConfig = this.getModelConfig(modelId);

    // 如果模型不在已知列表中，尝试懒加载检测
    if (!modelConfig) {
      //console.log(`🔍 模型 ${modelId} 不在预配置列表中，尝试动态检测...`);

      const discovered = await this.discoverModelsLazy(modelId);
      if (Object.keys(discovered).length > 0) {
        const discoveredId = Object.keys(discovered)[0];
        modelConfig = discovered[discoveredId];
        //console.log(`✅ 动态发现模型: ${modelConfig.name}`);
      } else {
        console.error(`❌ 模型不存在: ${modelId}`);
        //console.log('💡 可用模型列表:');
        this.listAllModels();
        return false;
      }
    }

    //console.log(`🔄 切换到模型: ${modelConfig.name}`);
    this.currentModel = modelId;

    // 重新初始化模型系统
    await this.initializeModel(modelConfig);
    return true;
  },

  // 初始化模型
  async initializeModel(modelConfig) {
    try {
      // 清除之前的模型
      if (window.modelManager) {
        if (window.modelManager.cubism2model) {
          window.modelManager.cubism2model.destroy();
        }
        if (window.modelManager.cubism5model) {
          window.modelManager.cubism5model.release();
        }
      }

      // 清除缓存
      localStorage.removeItem('modelId');
      localStorage.removeItem('modelTexturesId');
      localStorage.removeItem('waifu-display');

      // 构建新的配置
      const config = {
        waifuPath: live2d_path + 'waifu-tips.json',
        cubism5Path:
          'https://cdn.jsdelivr.net/gh/whisper8878/wg2d2@c26cd8784bda531cd8e41420be786af89bae7592/wg2d/src/CubismSdkForWeb-5-r.4/Core/live2dcubismcore.min.js',
        modelId: 0,
        modelTexturesId: 0,
        drag: false,
        logLevel: 'info',
        tools: ['hitokoto', 'photo', 'info', 'quit'],
        models: [modelConfig],
      };

      // 重新初始化
      if (window.initWidget) {
        window.initWidget(config);
        //console.log(`✅ ${modelConfig.name} 模型切换成功!`);
        return true;
      }
    } catch (error) {
      console.error(`❌ 模型切换失败:`, error);
      return false;
    }
  },
};

// 默认模型配置 - 现在支持动态切换
let DEFAULT_MODEL = 'ariu';

// 兼容性：获取当前模型配置
function getCurrentModelConfig() {
  return (
    ModelDiscovery.getModelConfig(DEFAULT_MODEL) ||
    ModelDiscovery.knownModels.ariu
  );
}

// 兼容性：模型配置映射（保持向后兼容）
const MODEL_CONFIGS = ModelDiscovery.knownModels;

// 智能Live2D缩放系统
const Live2DScaleManager = {
  // 默认配置
  config: {
    baseWidth: 400,
    baseHeight: 500,
    scaleFactor: 1.0,
    pixelRatio: window.devicePixelRatio || 1,
    enableHighDPI: true,
    autoResize: true,
    minScale: 0.5,
    maxScale: 3.0,
  },

  // 初始化缩放系统
  init(customConfig = {}) {
    this.config = { ...this.config, ...customConfig };
    //console.log('🎯 Live2D智能缩放系统初始化:', this.config);

    if (this.config.autoResize) {
      this.setupAutoResize();
    }
  },

  // 设置canvas尺寸和分辨率
  setCanvasSize(canvas, scale = this.config.scaleFactor) {
    if (!canvas) return false;

    const { baseWidth, baseHeight, pixelRatio, enableHighDPI } = this.config;

    // 计算显示尺寸
    const displayWidth = Math.round(baseWidth * scale);
    const displayHeight = Math.round(baseHeight * scale);

    // 计算实际渲染尺寸（考虑设备像素比）
    const renderWidth = enableHighDPI
      ? Math.round(displayWidth * pixelRatio)
      : displayWidth;
    const renderHeight = enableHighDPI
      ? Math.round(displayHeight * pixelRatio)
      : displayHeight;

    // 设置canvas实际尺寸（用于渲染）
    canvas.width = renderWidth;
    canvas.height = renderHeight;

    // 设置canvas显示尺寸（CSS样式）
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    // 如果启用高DPI，需要缩放WebGL上下文
    if (enableHighDPI && pixelRatio !== 1) {
      const ctx = canvas.getContext('webgl') || canvas.getContext('webgl2');
      if (ctx) {
        ctx.viewport(0, 0, renderWidth, renderHeight);
      }
    }

    //console.log('📐 Canvas尺寸设置完成:', {
    //  scale: scale,
    //  display: `${displayWidth}x${displayHeight}`,
    ////  render: `${renderWidth}x${renderHeight}`,
    //  pixelRatio: pixelRatio,
    //});

    return true;
  },

  // 动态缩放模型
  scaleModel(scaleFactor) {
    const clampedScale = Math.max(
      this.config.minScale,
      Math.min(this.config.maxScale, scaleFactor),
    );
    this.config.scaleFactor = clampedScale;

    const canvas = document.getElementById('live2d');
    if (canvas && canvas.getContext) {
      // 检查WebGL是否已初始化
      const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
      if (gl) {
        this.setCanvasSize(canvas, clampedScale);

        // 触发Live2D重新渲染
        if (window.modelManager && window.modelManager.cubism5model) {
          const subdelegates = window.modelManager.cubism5model._subdelegates;
          if (subdelegates && subdelegates.getSize() > 0) {
            const subdelegate = subdelegates.at(0);
            if (subdelegate && subdelegate.resizeCanvas) {
              subdelegate.resizeCanvas();
            }
          }
        }
      } else {
        console.warn('⚠️ WebGL未初始化，延迟应用缩放');
        // 延迟重试
        setTimeout(() => this.scaleModel(scaleFactor), 1000);
      }
    }

    return clampedScale;
  },

  // 设置自动调整大小
  setupAutoResize() {
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const canvas = document.getElementById('live2d');
        if (canvas) {
          this.setCanvasSize(canvas, this.config.scaleFactor);
        }
      }, 250);
    });
  },

  // 获取当前缩放信息
  getScaleInfo() {
    const canvas = document.getElementById('live2d');
    if (!canvas) return null;

    return {
      scaleFactor: this.config.scaleFactor,
      displaySize: {
        width: parseInt(canvas.style.width),
        height: parseInt(canvas.style.height),
      },
      renderSize: {
        width: canvas.width,
        height: canvas.height,
      },
      pixelRatio: this.config.pixelRatio,
    };
  },
};

// 封装异步加载资源的方法
function loadExternalResource(url, type) {
  return new Promise((resolve, reject) => {
    let tag;

    if (type === 'css') {
      tag = document.createElement('link');
      tag.rel = 'stylesheet';
      tag.href = url;
    } else if (type === 'js') {
      tag = document.createElement('script');
      tag.type = 'module';
      tag.src = url;
    }
    if (tag) {
      tag.onload = () => resolve(url);
      tag.onerror = () => reject(url);
      document.head.appendChild(tag);
    }
  });
}

(async () => {
  const currentModelConfig = MODEL_CONFIGS[DEFAULT_MODEL];

  //console.log(
  //  `🎭 [通用版本] ${currentModelConfig.name} 模型测试 - 开始加载 Live2D Widget`,
  //);

  // 强制清除 localStorage 缓存，确保加载新模型
  //console.log('🧹 清除 localStorage 缓存...');
  localStorage.removeItem('modelId');
  localStorage.removeItem('modelTexturesId');
  localStorage.removeItem('waifu-display');
  //console.log('✅ localStorage 缓存已清除');

  // 避免图片资源跨域问题
  const OriginalImage = window.Image;
  window.Image = function (...args) {
    const img = new OriginalImage(...args);
    img.crossOrigin = 'anonymous';
    return img;
  };
  window.Image.prototype = OriginalImage.prototype;

  try {
    // 加载 waifu.css 和 waifu-tips.js
    //console.log('📦 加载样式表和脚本文件...');
    await Promise.all([
      loadExternalResource(live2d_path + 'waifu.css', 'css'),
      loadExternalResource(live2d_path + 'waifu-tips.js', 'js'),
    ]);

    //console.log('✅ 样式表和脚本文件加载完成');

    // 等待 initWidget 函数可用
    let retryCount = 0;
    const maxRetries = 50;

    while (typeof window.initWidget !== 'function' && retryCount < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      retryCount++;
    }

    if (typeof window.initWidget !== 'function') {
      throw new Error('initWidget 函数加载超时');
    }

    //console.log('✅ initWidget 函数已准备就绪');

    // 构建模型数组
    const models = [currentModelConfig]; // 初始化 Widget 配置
    const config = {
      waifuPath: live2d_path + 'waifu-tips.json', // 使用CDN的 Cubism 5 Core
      cubism5Path:
        'https://cdn.jsdelivr.net/gh/whisper8878/wg2d2@c26cd8784bda531cd8e41420be786af89bae7592/wg2d/src/CubismSdkForWeb-5-r.4/Core/live2dcubismcore.min.js',
      // 强制指定使用当前模型（索引0）
      modelId: 0,
      // 强制重置纹理ID
      modelTexturesId: 0,
      // 禁用拖拽，避免 hitTest 错误
      drag: false,
      // 设置日志级别为详细
      logLevel: 'info',
      // 减少工具按钮，避免 tools.js 错误
      tools: ['hitokoto', 'photo', 'info', 'quit'],
      // 传入当前模型列表
      models: models,
    };

    //console.log(
    //`🚀 [通用版本] 初始化 Live2D Widget，当前模型：${currentModelConfig.name}`,
    //);
    console.log('配置详情:', {
      modelName: currentModelConfig.name,
      modelPath: currentModelConfig.paths[0],
      modelsArray: config.models,
    });

    // 强制在初始化前清除所有相关缓存
    //console.log('🧹 强制清除所有缓存...');
    localStorage.clear();
    sessionStorage.clear();
    //console.log('✅ 缓存已完全清除');

    // 初始化智能缩放系统（但不立即应用）
    Live2DScaleManager.init({
      baseWidth: 400,
      baseHeight: 500,
      scaleFactor: 2.0, // 默认放大2倍
      enableHighDPI: true,
      autoResize: true,
    }); // 初始化 Widget
    window.initWidget(config);

    console.log('✅ Live2D Widget 初始化完成');

    // 懒加载模式：不在启动时自动发现模型，避免CORS错误
    console.log('� 懒加载模式已启用 - 模型将在需要时动态加载');

    // 直接创建全局模型管理函数
    createGlobalModelManagementFunctions();

    // 显示预配置的模型列表
    console.log('📋 预配置模型列表:');
    Object.entries(ModelDiscovery.knownModels).forEach(([id, config]) => {
      console.log(`  - ${id}: ${config.name} - ${config.description}`);
    });

    console.log('💡 使用方法:');
    console.log('  - discoverAllModels() - 发现所有可用模型');
    console.log('  - switchModel("模型ID") - 切换到指定模型');
    console.log('  - switchToRandomModel() - 随机切换模型');
    console.log('  - listAllModels() - 查看所有可用模型');

    // 延迟检查实际加载的配置
    setTimeout(() => {
      //console.log('🔍 检查实际加载的配置...');
      if (window.modelManager && window.modelManager.config) {
        //console.log('📋 实际配置:', window.modelManager.config);
      }
      if (window.modelManager && window.modelManager.models) {
        //console.log('📋 实际模型列表:', window.modelManager.models);
      }
    }, 2000);

    // 检查当前系统自动加载状态的函数
    function checkCurrentAutoLoadStatus() {
      //console.log(`🔍 检查 ${currentModelConfig.name} 模型加载状态...`);

      try {
        // 尝试获取模型实例
        const manager = window.modelManager?.cubism5model;
        if (
          manager &&
          manager._subdelegates &&
          manager._subdelegates.getSize() > 0
        ) {
          const subdelegate = manager._subdelegates.at(0);
          if (subdelegate && subdelegate._live2dManager) {
            const live2dManager = subdelegate._live2dManager;
            if (live2dManager._models && live2dManager._models.getSize() > 0) {
              const model = live2dManager._models.at(0);

              //console.log('📊 模型加载状态:');
              //console.log('  - 模型存在:', !!model);
              //console.log('  - 表情容器:', !!model._expressions);
              //console.log('  - 动作容器:', !!model._motions);

              if (model) {
                // 保存到对应的全局变量
                window[currentModelConfig.globalVar] = model;
                //console.log(
                //`✅ ${currentModelConfig.name}模型实例已保存到 window.${currentModelConfig.globalVar}`,
                //);

                // 创建通用的表情测试函数
                createUniversalTestFunctions(model);
              }

              return !!model;
            }
          }
        }

        //console.log('❌ 模型未找到或未加载完成');
        return false;
      } catch (error) {
        //console.error('❌ 检查模型状态时出错:', error);
        return false;
      }
    }

    // 创建通用测试函数
    function createUniversalTestFunctions(model) {
      try {
        //console.log('🧪 创建通用测试函数...');

        // 表情测试函数
        if (model._expressions) {
          //console.log('  - 表情数量:', model._expressions.getSize());

          window.listExpressions = function () {
            //console.log('📋 可用表情列表:');
            for (let i = 0; i < model._expressions.getSize(); i++) {
              const key = model._expressions._keyValues[i].first;
              //console.log(`  ${i}: ${key}`);
            }
          };
          window.testExpressionByIndex = function (index) {
            if (model._expressions && index < model._expressions.getSize()) {
              const key = model._expressions._keyValues[index].first;
              //console.log(`🎭 测试表情: ${key}`);

              // 使用表情管理器播放表情
              const expression = model._expressions.getValue(key);
              if (expression && model._expressionManager) {
                model._expressionManager.startMotionPriority(
                  expression,
                  false,
                  10,
                );
                return true;
              }
            }
            return false;
          };

          // 添加按名称播放表情的函数（兼容原版API）
          window.playExpression = function (expressionName) {
            if (!model._expressions) {
              //console.log('❌ 表情系统未初始化');
              return false;
            }

            // 查找匹配的表情
            let foundKey = null;
            for (let i = 0; i < model._expressions.getSize(); i++) {
              const key = model._expressions._keyValues[i].first;
              if (key === expressionName || key.includes(expressionName)) {
                foundKey = key;
                break;
              }
            }

            if (!foundKey) {
              //console.log(`❌ 表情不存在: ${expressionName}`);
              //console.log('💡 可用表情列表:');
              window.listExpressions();
              return false;
            }

            try {
              const expression = model._expressions.getValue(foundKey);
              if (expression && model._expressionManager) {
                model._expressionManager.stopAllMotions();

                // 使用 setTimeout 确保之前的动作已停止
                setTimeout(() => {
                  const handle = model._expressionManager.startMotionPriority(
                    expression,
                    false,
                    10, // 使用更高的优先级
                  );

                  if (handle !== -1) {
                    //console.log(`🎭 播放表情: ${expressionName} (${foundKey})`);

                    // 维持表情状态的循环，对于说话等连续动作至关重要
                    const maintainExpression = () => {
                      if (model._expressionManager.isFinished()) {
                        // 如果表情播放完成，重新开始以维持状态
                        const newHandle =
                          model._expressionManager.startMotionPriority(
                            expression,
                            false,
                            10,
                          );
                        if (newHandle !== -1) {
                          setTimeout(maintainExpression, 100);
                        }
                      } else {
                        // 如果还在播放，则继续检查
                        setTimeout(maintainExpression, 100);
                      }
                    };

                    // 启动维持循环
                    setTimeout(maintainExpression, 100);
                    return true;
                  }
                }, 50); // 50ms 延迟
              }
            } catch (error) {
              console.error(`❌ 表情播放错误: ${error.message}`);
            }
            return false;
          };

          // 停止所有表情的函数
          window.stopAllExpressions = function () {
            if (model._expressionManager) {
              model._expressionManager.stopAllMotions();
              console.log('🛑 已停止所有表情');
              return true;
            }
            return false;
          };
        }

        // 动作测试函数
        if (model._motions) {
          //console.log('  - 动作数量:', model._motions.getSize());

          window.listMotions = function () {
            //console.log('📋 可用动作列表:');
            for (let i = 0; i < model._motions.getSize(); i++) {
              const key = model._motions._keyValues[i].first;
              //console.log(`  ${i}: ${key}`);
            }
          };

          window.testMotionByIndex = function (index) {
            if (model._motions && index < model._motions.getSize()) {
              const key = model._motions._keyValues[index].first;
              //console.log(`🎬 测试动作: ${key}`);

              // 解析动作键 (格式: group_index)
              const parts = key.split('_');
              if (parts.length >= 2) {
                const group = parts[0];
                const motionIndex = parseInt(parts[1]);
                model.startMotion(group, motionIndex, 3);
                return true;
              }
            }
            return false;
          };
        }

        // 参数控制函数
        if (
          model._model &&
          model._model._model &&
          model._model._model.parameters
        ) {
          const paramIds = model._model._model.parameters.ids;
          const paramValues = model._model._parameterValues;

          window.listParameters = function () {
            //console.log('📋 模型参数列表:');
            for (let i = 0; i < paramIds.length; i++) {
              //console.log(
              //`  ${i}: ${paramIds[i]} = ${paramValues[i].toFixed(3)}`,
              //);
            }
          };

          window.setParameter = function (paramName, value) {
            const index = paramIds.indexOf(paramName);
            if (index >= 0) {
              const oldValue = paramValues[index];
              paramValues[index] = value;
              //console.log(
              //`✅ 设置参数 ${paramName}: ${oldValue.toFixed(3)} → ${value}`,
              //);
              return true;
            }
            //console.log(`❌ 未找到参数: ${paramName}`);
            return false;
          };

          window.setParameterByIndex = function (index, value) {
            if (index >= 0 && index < paramIds.length) {
              const oldValue = paramValues[index];
              paramValues[index] = value;
              //console.log(
              //`✅ 设置参数[${index}] ${paramIds[index]}: ${oldValue.toFixed(
              //3,
              //)} → ${value}`,
              //);
              return true;
            }
            //console.log(`❌ 参数索引 ${index} 超出范围`);
            return false;
          };
        }

        // 创建实时参数控制函数
        createRealTimeParameterControl(model);

        // 创建缩放控制函数
        createScaleControlFunctions();

        // 模型加载完成后应用初始缩放
        setTimeout(() => {
          const canvas = document.getElementById('live2d');
          if (canvas && canvas.getContext('webgl')) {
            Live2DScaleManager.setCanvasSize(canvas);
            console.log('🎯 应用初始缩放设置 (2.0x)');
          }
        }, 500); //console.log('✅ 通用测试函数创建完成');
        //console.log('🧪 可用函数:');
        //console.log('  - listExpressions() - 列出所有表情');
        //console.log('  - testExpressionByIndex(index) - 测试指定索引的表情');
        //console.log('  - playExpression(name) - 按名称播放表情');
        //console.log('  - stopAllExpressions() - 停止所有表情');
        //console.log('  - listMotions() - 列出所有动作');
        //console.log('  - testMotionByIndex(index) - 测试指定索引的动作');
        //console.log('  - listParameters() - 列出所有参数');
        //console.log('  - setParameter(name, value) - 设置指定参数');
        //console.log('  - setParameterByIndex(index, value) - 按索引设置参数');
        //console.log('  - enableLiveMouth() - 启用实时嘴部控制');
        //console.log('  - enableLiveEyes() - 启用实时眼部控制');
        //console.log('  - disableLiveControl() - 禁用实时控制');
      } catch (error) {
        //console.error('❌ 创建测试函数时出错:', error);
      }
    }

    // 创建实时参数控制函数 - 使用新编译的CubismMouthTargetPoint系统
    function createRealTimeParameterControl(model) {
      try {
        //console.log('🎮 创建基于新编译系统的实时参数控制函数...');

        // 获取Live2D管理器和模型实例
        let live2dManager = null;
        let currentModel = null;

        // 尝试从全局变量获取管理器
        if (window.modelManager && window.modelManager.cubism5model) {
          const subdelegates = window.modelManager.cubism5model._subdelegates;
          if (subdelegates && subdelegates.getSize() > 0) {
            live2dManager = subdelegates.at(0)._live2dManager;
            if (live2dManager._models && live2dManager._models.getSize() > 0) {
              currentModel = live2dManager._models.at(0);
              //console.log('✅ 找到Live2D管理器和模型实例');
              //console.log(
              //'✅ 检测到新的嘴部管理器:',
              //currentModel._mouthManager,
              //);
            }
          }
        }

        if (!live2dManager || !currentModel) {
          //console.error('❌ 无法找到Live2D管理器或模型实例');
          return;
        }

        // 创建新的嘴部控制API - 直接使用编译后的系统
        window.setMouthTarget = function (value) {
          if (!live2dManager || !currentModel) {
            //console.error('❌ 系统未就绪');
            return false;
          }

          const clampedValue = Math.max(0, Math.min(1, value));
          live2dManager.setMouthTarget(clampedValue);
          //console.log(`👄 设置嘴部目标: ${clampedValue}`);
          return true;
        };

        window.setMouthImmediate = function (value) {
          if (!live2dManager || !currentModel) {
            //console.error('❌ 系统未就绪');
            return false;
          }

          const clampedValue = Math.max(0, Math.min(1, value));
          live2dManager.setMouthValueImmediate(clampedValue);
          //console.log(`👄 立即设置嘴部: ${clampedValue}`);
          return true;
        };

        window.getMouthValue = function () {
          if (!live2dManager || !currentModel) {
            return 0;
          }
          return live2dManager.getMouthValue();
        };

        // 说话动画
        window.startTalking = function (duration = 3000) {
          if (!live2dManager || !currentModel) {
            //console.error('❌ 系统未就绪');
            return false;
          }

          //console.log(`🗣️ 开始说话动画 (${duration}ms)...`);

          const talkingPattern = [
            { value: 0.0, duration: 100 },
            { value: 0.6, duration: 150 },
            { value: 0.2, duration: 120 },
            { value: 0.8, duration: 180 },
            { value: 0.3, duration: 140 },
            { value: 0.7, duration: 160 },
            { value: 0.1, duration: 110 },
            { value: 0.5, duration: 150 },
            { value: 0.0, duration: 130 },
          ];

          let currentIndex = 0;
          const startTime = Date.now();

          function playNext() {
            if (Date.now() - startTime >= duration) {
              window.setMouthTarget(0);
              //console.log('🗣️ 说话动画完成');
              return;
            }

            const step = talkingPattern[currentIndex % talkingPattern.length];
            window.setMouthTarget(step.value);

            setTimeout(() => {
              currentIndex++;
              playNext();
            }, step.duration);
          }

          playNext();
          return true;
        };

        // 闭嘴功能
        window.closeMouth = function () {
          return window.setMouthImmediate(0);
        };

        // 保留旧的API兼容性
        window.enableLiveMouth = function () {
          //console.log('✅ 新的嘴部控制系统已自动启用');
          //console.log('💡 使用 setMouthTarget(value) 来控制嘴部');
        };

        //console.log('✅ 基于新编译系统的嘴部控制API创建完成');
        //console.log('🧪 可用函数:');
        //console.log('  - setMouthTarget(value) - 设置嘴部目标值(0到1)');
        //console.log('  - setMouthImmediate(value) - 立即设置嘴部值(0到1)');
        //console.log('  - getMouthValue() - 获取当前嘴部值');
        //console.log('  - startTalking(duration) - 开始说话动画');
        //console.log('  - closeMouth() - 闭嘴');
      } catch (error) {
        //console.error('❌ 创建实时参数控制函数时出错:', error);
      }
    }

    // 创建缩放控制函数
    function createScaleControlFunctions() {
      try {
        //console.log('🔧 创建Live2D缩放控制函数...');

        // 缩放模型函数
        window.scaleModel = function (scaleFactor) {
          const actualScale = Live2DScaleManager.scaleModel(scaleFactor);
          //console.log(`📏 模型缩放至: ${actualScale}x`);
          return actualScale;
        };

        // 重置模型大小
        window.resetModelSize = function () {
          return window.scaleModel(1.0);
        };

        // 放大模型
        window.enlargeModel = function (factor = 1.5) {
          const currentScale = Live2DScaleManager.config.scaleFactor;
          return window.scaleModel(currentScale * factor);
        };

        // 缩小模型
        window.shrinkModel = function (factor = 0.75) {
          const currentScale = Live2DScaleManager.config.scaleFactor;
          return window.scaleModel(currentScale * factor);
        };

        // 设置高分辨率模式
        window.setHighDPI = function (enabled = true) {
          Live2DScaleManager.config.enableHighDPI = enabled;
          const canvas = document.getElementById('live2d');
          if (canvas) {
            Live2DScaleManager.setCanvasSize(canvas);
          }
          //console.log(`🖥️ 高分辨率模式: ${enabled ? '启用' : '禁用'}`);
        };

        // 获取缩放信息
        window.getModelScale = function () {
          const info = Live2DScaleManager.getScaleInfo();
          //console.log('📊 当前模型缩放信息:', info);
          return info;
        };

        // 预设缩放选项
        window.setModelSize = function (size) {
          const presets = {
            small: 0.8,
            normal: 1.0,
            large: 1.5,
            xlarge: 2.0,
            xxlarge: 2.5,
          };

          const scale = presets[size] || parseFloat(size) || 1.0;
          return window.scaleModel(scale);
        };

        //console.log('✅ 缩放控制函数创建完成');
        //console.log('🧪 可用缩放函数:');
        //console.log('  - scaleModel(factor) - 缩放模型到指定倍数');
        //console.log('  - resetModelSize() - 重置模型大小');
        //console.log('  - enlargeModel(factor) - 放大模型');
        //console.log('  - shrinkModel(factor) - 缩小模型');
        //console.log('  - setHighDPI(enabled) - 设置高分辨率模式');
        //console.log('  - getModelScale() - 获取缩放信息');
        //console.log(
        //  '  - setModelSize(size) - 使用预设大小 (small/normal/large/xlarge/xxlarge)',
        //);
      } catch (error) {
        console.error('❌ 创建缩放控制函数时出错:', error);
      }
    } // 定期检查模型加载状态
    let checkInterval = setInterval(() => {
      if (checkCurrentAutoLoadStatus()) {
        clearInterval(checkInterval);
        //console.log(`🎉 ${currentModelConfig.name}模型加载检查完成！`);
      }
    }, 1000); // 超时停止检查
    setTimeout(() => {
      clearInterval(checkInterval);
      //console.log('⏰ 模型加载检查超时');
    }, 15000);

    // 创建全局模型管理函数
    function createGlobalModelManagementFunctions() {
      try {
        //console.log('🔧 创建全局模型管理函数...');

        // 列出所有可用模型
        window.listAllModels = function () {
          return ModelDiscovery.listAllModels();
        };

        // 发现所有模型
        window.discoverAllModels = async function () {
          //console.log('🔍 开始发现所有可用模型...');
          const discovered = await ModelDiscovery.discoverAllModels();
          //console.log(
            //`🎯 发现完成! 总共发现了 ${
            //  Object.keys(discovered).length
            //} 个新模型`,
          //);

          // 显示所有模型
          ModelDiscovery.listAllModels();
          return discovered;
        };

        // 切换模型
        window.switchModel = async function (modelId) {
          if (!modelId) {
            //console.log('💡 用法: switchModel("模型ID")');
            //console.log('💡 可用模型列表:');
            window.listAllModels();
            return false;
          }

          return await ModelDiscovery.switchModel(modelId);
        };

        // 切换到随机模型
        window.switchToRandomModel = async function () {
          const allModels = ModelDiscovery.getAllModels();
          const modelIds = Object.keys(allModels);

          if (modelIds.length === 0) {
            console.log('❌ 没有可用的模型');
            return false;
          }

          // 排除当前模型
          const availableModels = modelIds.filter(
            (id) => id !== ModelDiscovery.currentModel,
          );

          if (availableModels.length === 0) {
            console.log('❌ 没有其他可切换的模型');
            return false;
          }

          const randomIndex = Math.floor(
            Math.random() * availableModels.length,
          );
          const randomModelId = availableModels[randomIndex];

          //console.log(`🎲 随机切换到: ${allModels[randomModelId].name}`);
          return await ModelDiscovery.switchModel(randomModelId);
        };

        // 获取当前模型信息
        window.getCurrentModel = function () {
          if (!ModelDiscovery.currentModel) {
            console.log('❌ 当前没有活动模型');
            return null;
          }

          const config = ModelDiscovery.getModelConfig(
            ModelDiscovery.currentModel,
          );
          console.log('📊 当前模型信息:', {
            id: ModelDiscovery.currentModel,
            name: config.name,
            description: config.description,
            source: config.discovered ? '动态发现' : '预配置',
          });

          return {
            id: ModelDiscovery.currentModel,
            config: config,
          };
        };

        // 按类型筛选模型
        window.listModelsByType = function (type) {
          const allModels = ModelDiscovery.getAllModels();
          const typeMap = {
            discovered: '动态发现',
            known: '预配置',
            all: '全部',
          };

          if (!typeMap[type]) {
            //console.log(
              //'💡 可用类型: discovered(动态发现), known(预配置), all(全部)',
            //);
            return;
          }

          //console.log(`📋 ${typeMap[type]}模型列表:`);
          Object.entries(allModels).forEach(([id, config]) => {
            const isDiscovered = config.discovered || false;
            if (
              type === 'all' ||
              (type === 'discovered' && isDiscovered) ||
              (type === 'known' && !isDiscovered)
            ) {
              const source = isDiscovered ? '(动态发现)' : '(预配置)';
              //console.log(
              //  `  - ${id}: ${config.name} ${source} - ${config.description}`,
              //);
            }
          });
        };

        // 批量切换模型测试
        window.testAllModels = async function (interval = 5000) {
          const allModels = ModelDiscovery.getAllModels();
          const modelIds = Object.keys(allModels);

          if (modelIds.length === 0) {
            console.log('❌ 没有可用的模型');
            return;
          }

          console.log(
            `🧪 开始测试所有模型 (每${interval / 1000}秒切换一次)...`,
          );

          for (let i = 0; i < modelIds.length; i++) {
            const modelId = modelIds[i];
            const config = allModels[modelId];

            console.log(
              `🔄 [${i + 1}/${modelIds.length}] 测试模型: ${config.name}`,
            );

            await ModelDiscovery.switchModel(modelId);

            // 等待指定时间后切换到下一个模型
            if (i < modelIds.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, interval));
            }
          }

          //console.log('✅ 所有模型测试完成!');
        };

        // 模型收藏功能
        if (!window.favoriteModels) {
          window.favoriteModels = [];
        }

        window.addToFavorites = function (modelId) {
          if (!ModelDiscovery.getModelConfig(modelId)) {
            console.log(`❌ 模型不存在: ${modelId}`);
            return false;
          }

          if (!window.favoriteModels.includes(modelId)) {
            window.favoriteModels.push(modelId);
            console.log(
              `⭐ 已添加到收藏: ${ModelDiscovery.getModelConfig(modelId).name}`,
            );

            // 保存到localStorage
            localStorage.setItem(
              'favoriteModels',
              JSON.stringify(window.favoriteModels),
            );
            return true;
          } else {
            console.log(
              `ℹ️ 模型已在收藏列表中: ${
                ModelDiscovery.getModelConfig(modelId).name
              }`,
            );
            return false;
          }
        };

        window.removeFromFavorites = function (modelId) {
          const index = window.favoriteModels.indexOf(modelId);
          if (index > -1) {
            window.favoriteModels.splice(index, 1);
            console.log(
              `🗑️ 已从收藏中移除: ${
                ModelDiscovery.getModelConfig(modelId).name
              }`,
            );

            // 保存到localStorage
            localStorage.setItem(
              'favoriteModels',
              JSON.stringify(window.favoriteModels),
            );
            return true;
          } else {
            //console.log(`ℹ️ 模型不在收藏列表中: ${modelId}`);
            return false;
          }
        };

        window.listFavorites = function () {
          if (window.favoriteModels.length === 0) {
            //console.log('💫 收藏列表为空');
            return;
          }

          //console.log('⭐ 收藏的模型:');
          window.favoriteModels.forEach((modelId, index) => {
            const config = ModelDiscovery.getModelConfig(modelId);
            if (config) {
              console.log(
                `  ${index + 1}. ${modelId}: ${config.name} - ${
                  config.description
                }`,
              );
            }
          });
        };

        window.switchToFavorite = async function (index) {
          if (
            typeof index !== 'number' ||
            index < 1 ||
            index > window.favoriteModels.length
          ) {
            //console.log('💡 用法: switchToFavorite(序号)');
            window.listFavorites();
            return false;
          }

          const modelId = window.favoriteModels[index - 1];
          return await ModelDiscovery.switchModel(modelId);
        };

        // 从localStorage加载收藏列表
        try {
          const savedFavorites = localStorage.getItem('favoriteModels');
          if (savedFavorites) {
            window.favoriteModels = JSON.parse(savedFavorites);
          }
        } catch (error) {
          console.warn('⚠️ 加载收藏列表失败:', error);
        }

        //console.log('✅ 全局模型管理函数创建完成');
        //console.log('🧪 可用模型管理函数:');
        //console.log('  - listAllModels() - 列出所有可用模型');
        //console.log('  - discoverAllModels() - 发现所有可用模型（懒加载）');
        //console.log('  - switchModel(modelId) - 切换到指定模型');
        //console.log('  - switchToRandomModel() - 随机切换模型');
        //console.log('  - getCurrentModel() - 获取当前模型信息');
        //console.log('  - listModelsByType(type) - 按类型列出模型');
        //console.log('  - testAllModels(interval) - 批量测试所有模型');
        //console.log('  - addToFavorites(modelId) - 添加到收藏');
        //console.log('  - removeFromFavorites(modelId) - 从收藏中移除');
        //console.log('  - listFavorites() - 列出收藏的模型');
        //console.log('  - switchToFavorite(index) - 切换到收藏的模型');
      } catch (error) {
        console.error('❌ 创建全局模型管理函数时出错:', error);
      }
    }
  } catch (error) {
    console.error('❌ 加载过程中出错:', error);
  }
})();
