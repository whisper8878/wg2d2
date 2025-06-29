/*!
 * Live2D Widget Enhanced - CDN版本
 * 支持CDN模型加载和表情预加载功能
 * 基于 live2d-widget 项目增强
 */

// CDN配置
const live2d_path = 'https://cdn.jsdelivr.net/gh/whisper8878/wg2d@master/wg2d/dist/';
const CDN_BASE = 'https://raw.githubusercontent.com/whisper8878/model/master/assets/';

// 全局变量
let availableExpressions = [];
let isExpressionSystemReady = false;

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
  const prefix = '[Live2D Enhanced]';
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
    logMessage('🚀 开始加载Live2D Widget Enhanced...');

    // 加载CSS和JS
    await Promise.all([
      loadExternalResource(live2d_path + 'waifu.css', 'css'),
      loadExternalResource(live2d_path + 'waifu-tips.js', 'js'),
    ]);

    logMessage('✅ 核心文件加载完成');

    // 等待initWidget函数可用
    let retries = 0;
    while (typeof window.initWidget !== 'function' && retries < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
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
            'https://cdn.jsdelivr.net/gh/whisper8878/wg2d@master/wg2d/src/CubismSdkForWeb-5-r.4/Core/live2dcubismcore.min.js',
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
              logMessage(`⏳ 模型还未就绪，重试 ${retries}/${maxRetries}...`, 'warn');
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
        // 方法1: 通过modelManager.cubism5model (本地版本的正确路径)
        const manager = window.modelManager?.cubism5model;
        if (manager && manager._subdelegates && manager._subdelegates.getSize() > 0) {
          const subdelegate = manager._subdelegates.at(0);
          if (subdelegate && subdelegate._live2dManager) {
            const live2dManager = subdelegate._live2dManager;
            if (live2dManager._models && live2dManager._models.getSize() > 0) {
              const model = live2dManager._models.at(0);
              logMessage(`✅ 通过modelManager.cubism5model获取到模型: ${model.constructor.name}`);
              return model;
            }
          }
        }

        // 方法2: 通过modelManager.getCurrentModel (备用方法)
        if (window.modelManager && window.modelManager.getCurrentModel) {
          const model = window.modelManager.getCurrentModel();
          if (model) {
            logMessage(`✅ 通过modelManager.getCurrentModel获取到模型: ${model.constructor.name}`);
            return model;
          }
        }

        // 方法3: 检查canvas上下文中的模型
        const canvas = document.getElementById('live2d');
        if (canvas && canvas._live2dModel) {
          logMessage(`✅ 通过canvas获取到模型: ${canvas._live2dModel.constructor.name}`);
          return canvas._live2dModel;
        }

        logMessage(`⚠️ 无法获取当前模型，尝试的方法都失败了`, 'warn');
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

        // 清空之前的表情
        model._expressions.clear();
        availableExpressions = [];

        let loadedCount = 0;

        for (let i = 0; i < expressionCount; i++) {
          try {
            const expressionName = modelSetting.getExpressionName(i);
            const expressionFileName = modelSetting.getExpressionFileName(i);
            const url = model._modelHomeDir + expressionFileName;
            const expressionKey = expressionName || `expression_${i}`;

            logMessage(`📥 预加载表情 ${i + 1}/${expressionCount}: ${expressionName}`);

            const res = await fetch(url);
            if (!res.ok) {
              logMessage(`❌ 网络错误: ${expressionFileName}`, 'error');
              continue;
            }

            const buffer = await res.arrayBuffer();
            const expression = model.loadExpression(buffer, buffer.byteLength, expressionKey);

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

            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            logMessage(`❌ 表情加载错误: ${error.message}`, 'error');
          }
        }

        isExpressionSystemReady = true;
        logMessage(`🎭 表情系统初始化完成！成功预加载 ${loadedCount}/${expressionCount} 个表情`);

        // 创建表情播放函数
        createExpressionFunctions(model);

        return true;
      } catch (error) {
        logMessage(`❌ 表情系统初始化失败: ${error.message}`, 'error');
        return false;
      }
    };

    // 创建表情播放函数
    function createExpressionFunctions(model) {
      // 表情播放函数
      window.playExpression = function (expressionName) {
        if (!isExpressionSystemReady) {
          logMessage('❌ 表情系统未就绪，请先调用 initExpressions()', 'warn');
          return false;
        }

        const expressionData = availableExpressions.find(exp => exp.name === expressionName);
        if (!expressionData) {
          logMessage(`❌ 表情不存在: ${expressionName}`, 'error');
          logMessage(`💡 可用表情: ${availableExpressions.map(exp => exp.name).join(', ')}`);
          return false;
        }

        try {
          const expression = model._expressions.getValue(expressionData.key);
          if (expression) {
            model._expressionManager.stopAllMotions();
            const handle = model._expressionManager.startMotionPriority(expression, false, 10);

            if (handle !== -1) {
              logMessage(`🎭 播放表情: ${expressionName}`);
              return true;
            } else {
              logMessage(`❌ 表情播放失败: ${expressionName}`, 'error');
              return false;
            }
          }
        } catch (error) {
          logMessage(`❌ 播放表情错误: ${error.message}`, 'error');
          return false;
        }
      };

      // 获取可用表情列表
      window.getAvailableExpressions = function () {
        return availableExpressions.map(exp => exp.name);
      };

      // 随机播放表情
      window.playRandomExpression = function () {
        if (availableExpressions.length === 0) {
          logMessage('❌ 没有可用的表情', 'warn');
          return false;
        }

        const randomExpression = availableExpressions[Math.floor(Math.random() * availableExpressions.length)];
        return window.playExpression(randomExpression.name);
      };
    }

    // 默认初始化（可选）
    // 如果需要自动加载默认模型，取消下面的注释
    // setTimeout(() => {
    //   logMessage('🚀 自动加载默认模型...');
    //   window.loadCDNModel('ariu');
    // }, 1000);

    logMessage('🌟 Live2D Widget Enhanced 初始化完成！');
    logMessage('💡 使用方法:');
    logMessage('   loadCDNModel("模型名") - 加载CDN模型 (如: ariu, xiaoeemo)');
    logMessage('   initExpressions() - 初始化表情系统');
    logMessage('   playExpression("表情名") - 播放表情');
    logMessage('   getAvailableExpressions() - 获取可用表情列表');
    logMessage('📋 可用模型: ariu, xiaoeemo (使用英文文件夹名)');
  } catch (error) {
    logMessage(`❌ Live2D Widget Enhanced 初始化失败: ${error.message}`, 'error');
  }
})();

console.log(
  `\n%cLive2D%cWidget%cEnhanced%c\n`,
  'padding: 8px; background: #cd3e45; font-weight: bold; font-size: large; color: white;',
  'padding: 8px; background: #ff5450; font-size: large; color: #eee;',
  'padding: 8px; background: #4CAF50; font-size: large; color: white;',
  '',
);
