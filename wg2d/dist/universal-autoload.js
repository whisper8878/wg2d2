/*!
 * Live2D Widget - 通用模型加载脚本
 * 支持 Ariu 和小恶魔模型的自动切换
 * 基于 live2d-widget 项目
 */

// 使用本地路径
const live2d_path =
  'https://cdn.jsdelivr.net/gh/whisper8878/wg2d2@main/wg2d/dist/';
const CDN_BASE = 'https://cdn.jsdelivr.net/gh/whisper8878/model2@main/model/';

// 模型配置 - 默认使用 Ariu 模型
// 要切换模型，只需修改 DEFAULT_MODEL 的值：
// 'ariu' - 使用 Ariu 模型
// 'xiaoeemo' - 使用小恶魔模型
const DEFAULT_MODEL = 'ariu';

// 模型配置映射
const MODEL_CONFIGS = {
  ariu: {
    name: 'Ariu',
    message: 'Ariu模型加载成功！',
    paths: [`${CDN_BASE}ariu/ariu.model3.json`],
    globalVar: 'ariuModel',
  },
  xiaoeemo: {
    name: '小恶魔',
    message: '小恶魔模型加载成功！',
    paths: [`${CDN_BASE}xiaoeemo/xiaoeemo.model3.json`],
    globalVar: 'xiaoeemoModel',
  },
};

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
    console.log('🎯 Live2D智能缩放系统初始化:', this.config);

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

    console.log('📐 Canvas尺寸设置完成:', {
      scale: scale,
      display: `${displayWidth}x${displayHeight}`,
      render: `${renderWidth}x${renderHeight}`,
      pixelRatio: pixelRatio,
    });

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
      waifuPath: live2d_path + 'waifu-tips.json',      // 使用CDN的 Cubism 5 Core
      cubism5Path:
        'https://cdn.jsdelivr.net/gh/whisper8878/wg2d2@main/wg2d/src/CubismSdkForWeb-5-r.4/Core/live2dcubismcore.min.js',
      // 强制指定使用当前模型（索引0）
      modelId: 0,
      // 强制重置纹理ID
      modelTexturesId: 0,
      // 禁用拖拽，避免 hitTest 错误
      drag: true,
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
    });

    // 初始化 Widget
    window.initWidget(config);

    console.log('✅ Live2D Widget 初始化完成');

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

              console.log('📊 模型加载状态:');
              console.log('  - 模型存在:', !!model);
              console.log('  - 表情容器:', !!model._expressions);
              console.log('  - 动作容器:', !!model._motions);

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
          console.log('  - 表情数量:', model._expressions.getSize());

          window.listExpressions = function () {
            console.log('📋 可用表情列表:');
            for (let i = 0; i < model._expressions.getSize(); i++) {
              const key = model._expressions._keyValues[i].first;
              console.log(`  ${i}: ${key}`);
            }
          };

          window.testExpressionByIndex = function (index) {
            if (model._expressions && index < model._expressions.getSize()) {
              const key = model._expressions._keyValues[index].first;
              console.log(`🎭 测试表情: ${key}`);

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
        }

        // 动作测试函数
        if (model._motions) {
          console.log('  - 动作数量:', model._motions.getSize());

          window.listMotions = function () {
            console.log('📋 可用动作列表:');
            for (let i = 0; i < model._motions.getSize(); i++) {
              const key = model._motions._keyValues[i].first;
              console.log(`  ${i}: ${key}`);
            }
          };

          window.testMotionByIndex = function (index) {
            if (model._motions && index < model._motions.getSize()) {
              const key = model._motions._keyValues[index].first;
              console.log(`🎬 测试动作: ${key}`);

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
        }, 500);

        //console.log('✅ 通用测试函数创建完成');
        //console.log('🧪 可用函数:');
        //console.log('  - listExpressions() - 列出所有表情');
        //console.log('  - testExpressionByIndex(index) - 测试指定索引的表情');
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
        console.log('🔧 创建Live2D缩放控制函数...');

        // 缩放模型函数
        window.scaleModel = function (scaleFactor) {
          const actualScale = Live2DScaleManager.scaleModel(scaleFactor);
          console.log(`📏 模型缩放至: ${actualScale}x`);
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
          console.log(`🖥️ 高分辨率模式: ${enabled ? '启用' : '禁用'}`);
        };

        // 获取缩放信息
        window.getModelScale = function () {
          const info = Live2DScaleManager.getScaleInfo();
          console.log('📊 当前模型缩放信息:', info);
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

        console.log('✅ 缩放控制函数创建完成');
        console.log('🧪 可用缩放函数:');
        console.log('  - scaleModel(factor) - 缩放模型到指定倍数');
        console.log('  - resetModelSize() - 重置模型大小');
        console.log('  - enlargeModel(factor) - 放大模型');
        console.log('  - shrinkModel(factor) - 缩小模型');
        console.log('  - setHighDPI(enabled) - 设置高分辨率模式');
        console.log('  - getModelScale() - 获取缩放信息');
        console.log(
          '  - setModelSize(size) - 使用预设大小 (small/normal/large/xlarge/xxlarge)',
        );
      } catch (error) {
        console.error('❌ 创建缩放控制函数时出错:', error);
      }
    }

    // 定期检查模型加载状态
    let checkInterval = setInterval(() => {
      if (checkCurrentAutoLoadStatus()) {
        clearInterval(checkInterval);
        //console.log(`🎉 ${currentModelConfig.name}模型加载检查完成！`);
      }
    }, 1000);

    // 超时停止检查
    setTimeout(() => {
      clearInterval(checkInterval);
      //console.log('⏰ 模型加载检查超时');
    }, 15000);
  } catch (error) {
    console.error('❌ 加载过程中出错:', error);
  }
})();
