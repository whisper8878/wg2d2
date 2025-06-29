/*!
 * Live2D Widget Enhanced (Smart Talk Edition) - CDN版本
 * 支持CDN模型加载、表情预加载、智能说话功能
 * 基于 live2d-widget 项目增强
 */

// CDN配置
const live2d_path =
  'https://cdn.jsdelivr.net/gh/whisper8878/wg2d2@master/wg2d/dist/';
const CDN_BASE = 'https://cdn.jsdelivr.net/gh/whisper8878/model2@master/model/';

// 全局变量
let availableExpressions = [];
let isExpressionSystemReady = false;
let isTalking = false;

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

// 日志函数
function logMessage(message, level = 'info') {
  const prefix = '[Live2D SmartTalk]';
  if (level === 'error') {
    console.error(`${prefix} ${message}`);
  } else if (level === 'warn') {
    console.warn(`${prefix} ${message}`);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

(async () => {
  // 避免图片资源跨域问题
  const OriginalImage = window.Image;
  window.Image = function (...args) {
    const img = new OriginalImage(...args);
    img.crossOrigin = 'anonymous';
    return img;
  };
  window.Image.prototype = OriginalImage.prototype;

  try {
    logMessage('🚀 开始加载Live2D Widget Enhanced (Smart Talk Edition)...');

    // 加载CSS和JS
    await Promise.all([
      loadExternalResource(live2d_path + 'waifu.css', 'css'),
      loadExternalResource(live2d_path + 'waifu-tips.js', 'js'),
    ]);

    logMessage('✅ 核心文件加载完成');

    // 等待initWidget函数可用
    let retries = 0;
    while (typeof window.initWidget !== 'function' && retries < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      retries++;
    }

    if (typeof window.initWidget !== 'function') {
      throw new Error('initWidget函数加载超时');
    }

    logMessage('✅ initWidget函数已就绪');

    // 创建CDN模型加载函数
    window.loadCDNModel = async function (modelName) {
      try {
        logMessage(`🌐 开始加载CDN模型: ${modelName}`);

        // 重置canvas
        const waifuEl = document.getElementById('waifu');
        if (waifuEl) {
          const canvas = waifuEl.querySelector('#live2d');
          if (canvas) {
            canvas.width = 400;
            canvas.height = 500;
          }
        }

        // CDN模型配置
        const config = {
          waifuPath: live2d_path + 'waifu-tips.json',
          cubism5Path:
            'https://cdn.jsdelivr.net/gh/whisper8878/wg2d2@master/wg2d/src/CubismSdkForWeb-5-r.4/Core/live2dcubismcore.min.js',
          models: [
            {
              name: modelName,
              message: `${modelName} CDN模型加载成功！`,
              paths: [`${CDN_BASE}${modelName}/${modelName}.model3.json`],
            },
          ],
          modelId: 0,
          drag: true,
          logLevel: 'info',
          tools: ['switch-model', 'switch-texture', 'photo', 'info', 'quit'],
        };

        // 初始化Widget
        window.initWidget(config);

        logMessage(`✅ ${modelName} 模型配置完成，等待加载...`);

        // 等待模型加载完成后自动初始化表情系统
        setTimeout(async () => {
          logMessage('🎭 自动初始化表情系统...');

          // 重试机制，最多尝试10次
          let retries = 0;
          const maxRetries = 10;

          const tryInitExpressions = async () => {
            const model = window.getCurrentCDNModel();
            if (model) {
              logMessage('✅ 模型已就绪，开始初始化表情系统');
              await window.initExpressions();
            } else if (retries < maxRetries) {
              retries++;
              logMessage(
                `⏳ 模型还未就绪，重试 ${retries}/${maxRetries}...`,
                'warn',
              );
              setTimeout(tryInitExpressions, 1000);
            } else {
              logMessage('❌ 模型加载超时，表情系统初始化失败', 'error');
            }
          };

          tryInitExpressions();
        }, 3000);

        return true;
      } catch (error) {
        logMessage(`❌ 加载CDN模型失败: ${error.message}`, 'error');
        return false;
      }
    };

    // 获取当前模型
    window.getCurrentCDNModel = function () {
      try {
        // 方法1: 通过modelManager.cubism5model
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
              logMessage(`✅ 通过modelManager.cubism5model获取到模型`);
              return model;
            }
          }
        }

        // 方法2: 通过modelManager.getCurrentModel
        if (window.modelManager && window.modelManager.getCurrentModel) {
          const model = window.modelManager.getCurrentModel();
          if (model) {
            logMessage(`✅ 通过modelManager.getCurrentModel获取到模型`);
            return model;
          }
        }

        logMessage(`⚠️ 无法获取当前模型`, 'warn');
        return null;
      } catch (error) {
        logMessage(`❌ 获取当前模型失败: ${error.message}`, 'error');
        return null;
      }
    };

    // 表情预加载系统
    window.initExpressions = async function () {
      try {
        logMessage('🎭 开始初始化表情预加载系统...');

        const model = window.getCurrentCDNModel();
        if (!model) {
          logMessage('❌ 模型未就绪，请先加载模型', 'warn');
          return false;
        }

        const modelSetting = model._modelSetting;
        const expressionCount = modelSetting.getExpressionCount();

        if (expressionCount === 0) {
          logMessage('⚠️ 当前模型没有配置表情文件', 'warn');
          return false;
        }

        logMessage(`📊 发现 ${expressionCount} 个表情，开始预加载...`);

        model._expressions.clear();
        availableExpressions = [];
        let loadedCount = 0;

        for (let i = 0; i < expressionCount; i++) {
          try {
            const expressionName = modelSetting.getExpressionName(i);
            const expressionFileName = modelSetting.getExpressionFileName(i);
            const url = model._modelHomeDir + expressionFileName;
            const expressionKey = expressionName || `expression_${i}`;

            logMessage(
              `📥 预加载表情 ${i + 1}/${expressionCount}: ${expressionName}`,
            );

            const res = await fetch(url);
            if (!res.ok) {
              logMessage(`❌ 网络错误: ${expressionFileName}`, 'error');
              continue;
            }

            const buffer = await res.arrayBuffer();
            const expression = model.loadExpression(
              buffer,
              buffer.byteLength,
              expressionKey,
            );

            if (expression) {
              model._expressions.setValue(expressionKey, expression);
              availableExpressions.push({
                name: expressionName,
                key: expressionKey,
                fileName: expressionFileName,
                index: i,
              });
              loadedCount++;
              logMessage(`✅ 成功预加载: ${expressionName}`);
            } else {
              logMessage(`❌ 创建失败: ${expressionFileName}`, 'error');
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
          } catch (error) {
            logMessage(`❌ 表情加载错误: ${error.message}`, 'error');
          }
        }

        isExpressionSystemReady = true;
        logMessage(
          `🎭 表情系统初始化完成！成功预加载 ${loadedCount}/${expressionCount} 个表情`,
        );
        createExpressionFunctions(model);
        return true;
      } catch (error) {
        logMessage(`❌ 表情系统初始化失败: ${error.message}`, 'error');
        return false;
      }
    };

    // 创建表情播放函数
    function createExpressionFunctions(model) {
      window.playExpression = function (expressionName) {
        if (!isExpressionSystemReady) {
          logMessage('❌ 表情系统未就绪', 'warn');
          return false;
        }
        const expressionData = availableExpressions.find(
          (exp) => exp.name === expressionName,
        );
        if (!expressionData) {
          logMessage(`❌ 表情不存在: ${expressionName}`, 'error');
          return false;
        }
        try {
          const expression = model._expressions.getValue(expressionData.key);
          if (expression) {
            model._expressionManager.stopAllMotions();
            model._expressionManager.startMotionPriority(expression, false, 10);
            logMessage(`🎭 播放表情: ${expressionName}`);
            return true;
          }
        } catch (error) {
          logMessage(`❌ 播放表情错误: ${error.message}`, 'error');
        }
        return false;
      };

      window.getAvailableExpressions = function () {
        return availableExpressions.map((exp) => exp.name);
      };

      window.playRandomExpression = function () {
        if (availableExpressions.length === 0) {
          logMessage('❌ 没有可用的表情', 'warn');
          return false;
        }
        const randomExpression =
          availableExpressions[
            Math.floor(Math.random() * availableExpressions.length)
          ];
        return window.playExpression(randomExpression.name);
      };
    }

    // --- 新增功能：智能说话 ---

    /**
     * 设置模型参数值的辅助函数
     * @param {object} model - Live2D模型实例
     * @param {string} paramName - 要设置的参数名称 (e.g., "ParamMouthOpenY")
     * @param {number} value - 要设置的值
     * @returns {boolean} - 是否设置成功
     */
    function setParameterValue(model, paramName, value) {
      try {
        if (!model?._model?._model?.parameters) {
          return false;
        }
        const paramIds = model._model._model.parameters.ids;
        const paramValues = model._model._parameterValues;
        const index = paramIds.indexOf(paramName);

        if (index !== -1) {
          paramValues[index] = value;
          return true;
        }
      } catch (error) {
        // 忽略小错误
      }
      return false;
    }

    /**
     * 智能说话函数，驱动模型嘴巴进行动画
     * @param {number} [duration=2000] - 说话动画的持续时间 (毫秒)
     */
    window.smartTalk = function (duration = 2000) {
      if (isTalking) {
        logMessage('🎤 正在说话中，请勿重复调用', 'warn');
        return;
      }

      const model = window.getCurrentCDNModel();
      if (!model) {
        logMessage('❌ 模型未就绪，无法说话', 'error');
        return;
      }

      const mouthParamId = 'ParamMouthOpenY';
      logMessage(`🎤 开始智能说话，持续 ${duration}ms...`);
      isTalking = true;

      const startTime = Date.now();
      let animationFrameId;

      function talkLoop() {
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime > duration) {
          setParameterValue(model, mouthParamId, 0); // 确保嘴巴闭合
          isTalking = false;
          logMessage('🎤 说话结束');
          cancelAnimationFrame(animationFrameId);
          return;
        }

        // 使用正弦函数模拟嘴巴的平滑张合
        const mouthValue = (Math.sin(elapsedTime / 100) + 1) / 2;
        setParameterValue(model, mouthParamId, mouthValue);

        animationFrameId = requestAnimationFrame(talkLoop);
      }

      talkLoop();
    };

    logMessage('🌟 Live2D Widget Enhanced (Smart Talk Edition) 初始化完成！');
    logMessage('💡 使用方法:');
    logMessage('   loadCDNModel("模型名") - 加载CDN模型 (如: ariu, xiaoeemo)');
    logMessage('   initExpressions() - 初始化表情系统');
    logMessage('   playExpression("表情名") - 播放表情');
    logMessage('   getAvailableExpressions() - 获取可用表情列表');
    logMessage('   smartTalk(duration) - 播放口型动画 (可选时长)');
    logMessage('📋 可用模型: ariu, xiaoeemo (使用英文文件夹名)');
  } catch (error) {
    logMessage(
      `❌ Live2D Widget Enhanced 初始化失败: ${error.message}`,
      'error',
    );
  }
})();

console.log(
  `\n%cLive2D%cWidget%cSmartTalk%c\n`,
  'padding: 8px; background: #cd3e45; font-weight: bold; font-size: large; color: white;',
  'padding: 8px; background: #ff5450; font-size: large; color: #eee;',
  'padding: 8px; background: #2196F3; font-size: large; color: white;',
  '',
);
