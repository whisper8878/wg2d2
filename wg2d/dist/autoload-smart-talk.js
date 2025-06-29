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
let isSystemReady = false;
let isTalking = false;
// let externalLogger = null; // 已移除外部日志记录器以避免递归错误

// 注册外部日志记录器 (已移除)
// window.setLive2DLogger = (loggerFunc) => {
//   if (typeof loggerFunc === 'function') {
//     externalLogger = loggerFunc;
//   }
// };

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
  const fullMessage = `${prefix} ${message}`;

  // 1. 总是打印到控制台
  if (level === 'error') {
    console.error(fullMessage);
  } else if (level === 'warn') {
    console.warn(fullMessage);
  } else {
    console.log(fullMessage);
  }

  // 2. 外部记录器功能已移除，以防止无限递归错误。
  // if (externalLogger) {
  //   try {
  //     externalLogger(message, level);
  //   } catch (e) {
  //     console.error('[Live2D SmartTalk] 调用外部日志记录器时出错:', e);
  //     externalLogger = null; // 防止再次出错
  //   }
  // }
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

        // 高分辨率放大2倍
        const waifuEl = document.getElementById('waifu');
        if (waifuEl) {
          const canvas = waifuEl.querySelector('#live2d');
          if (canvas) {
            canvas.width = 800;
            canvas.height = 1000;
            canvas.style.width = '800px';
            canvas.style.height = '1000px';
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

        // 等待模型加载完成后自动初始化智能说话系统
        let checkCount = 0;
        const maxChecks = 30;
        const checkModelInterval = setInterval(() => {
          checkCount++;
          const model = window.getCurrentCDNModel();
          if (model) {
            clearInterval(checkModelInterval);
            logMessage('✅ 模型加载完成！');
            setTimeout(() => {
              autoInitializeExpressionSystem().then((success) => {
                if (success) {
                  logMessage('🎉 智能说话系统初始化完成！', 'success');
                  logMessage(
                    '💡 尝试在控制台输入: smartTalk() 或 randomTalk()',
                    'success',
                  );
                }
              });
            }, 1000);
            isSystemReady = true;
          } else if (checkCount >= maxChecks) {
            clearInterval(checkModelInterval);
            logMessage('❌ 模型加载超时，请刷新页面重试', 'error');
          } else {
            logMessage(`⏳ 等待模型加载... (${checkCount}/${maxChecks})`);
          }
        }, 1000);

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

    // 自动初始化表情和说话系统
    async function autoInitializeExpressionSystem() {
      logMessage('🎭 开始自动初始化智能说话系统...');
      const model = window.getCurrentCDNModel();
      if (!model) {
        logMessage('❌ 模型未就绪，等待模型加载完成...', 'error');
        return false;
      }
      logMessage('✅ 找到模型，开始预加载表情...');
      const modelSetting = model._modelSetting;
      const expressionCount = modelSetting.getExpressionCount();
      if (expressionCount === 0) {
        logMessage('⚠️ 模型没有配置表情文件，将使用参数控制', 'warning');
        createParameterBasedMouthControl(model);
        return true;
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
            });
            loadedCount++;
          } else {
            logMessage(`❌ 创建失败: ${expressionFileName}`, 'error');
          }
        } catch (error) {
          logMessage(`❌ 表情加载错误: ${error.message}`, 'error');
        }
      }
      createExpressionFunctions(model);
      logMessage(
        `🎭 表情系统初始化完成！成功预加载 ${loadedCount}/${expressionCount} 个表情`,
        'success',
      );
      return true;
    }

    // 创建基于表情的函数（已从 universal-test.html 增强）
    function createExpressionFunctions(model) {
      // 持续表情播放
      window.playExpression = function (expressionName) {
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

            // 使用 setTimeout 确保之前的动作已停止
            setTimeout(() => {
              const handle = model._expressionManager.startMotionPriority(
                expression,
                false,
                10, // 使用更高的优先级
              );

              if (handle !== -1) {
                logMessage(`🎭 播放表情: ${expressionName}`, 'success'); // <--- 添加日志

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
          logMessage(`❌ 表情播放错误: ${error.message}`, 'error');
        }
        return false;
      };

      window.listExpressions = function () {
        console.log(availableExpressions.map((e) => e.name));
        logMessage(
          `可用表情: ${availableExpressions.map((e) => e.name).join(', ')}`,
        );
      };
    }

    // 创建基于参数的嘴部控制
    function createParameterBasedMouthControl(model) {
      logMessage('🔧 创建基于参数的嘴部控制系统...');
      if (!model?._model?._model?.parameters) {
        logMessage('❌ 无法访问模型参数', 'error');
        return false;
      }
      const paramIds = model._model._model.parameters.ids;
      const paramValues = model._model._parameterValues;
      const mouthParam = ['ParamMouthOpenY', 'ParamJawOpen']
        .map((id) => ({ id, index: paramIds.indexOf(id) }))
        .find((p) => p.index >= 0);
      if (mouthParam) {
        logMessage(`✅ 找到嘴巴参数: ${mouthParam.id}`, 'success');
        window.setMouthValue = (value) => {
          paramValues[mouthParam.index] = value;
        };
        return true;
      }
      logMessage('❌ 未找到嘴巴控制参数', 'error');
      return false;
    }

    // --- 智能说话系统 (已从 universal-test.html 增强) ---
    window.smartTalk = function () {
      logMessage('💬 开始智能说话...');
      if (isTalking) {
        logMessage('⚠️ 正在说话中，请勿重复调用', 'warn');
        return;
      }

      const model = window.getCurrentCDNModel();
      if (!model) {
        logMessage('❌ 模型未就绪', 'error');
        return;
      }

      isTalking = true;

      if (availableExpressions.length > 0) {
        // 使用表情文件的智能说话
        const talkingSequence = [
          { name: 'mouth_close', duration: 320 },
          { name: 'mouth_slight', duration: 380 },
          { name: 'mouth_half', duration: 350 },
          { name: 'mouth_open', duration: 300 },
          { name: 'mouth_half', duration: 330 },
          { name: 'mouth_slight', duration: 360 },
          { name: 'mouth_close', duration: 300 },
          { name: 'mouth_slight', duration: 340 },
          { name: 'mouth_open', duration: 380 },
          { name: 'mouth_half', duration: 320 },
          { name: 'mouth_close', duration: 350 },
        ];

        let currentIndex = 0;

        function playNextFrame() {
          if (currentIndex >= talkingSequence.length) {
            setTimeout(() => {
              if (window.playExpression) {
                window.playExpression('mouth_close');
              }
              logMessage('💬 智能说话完成', 'success');
              isTalking = false;
            }, 300);
            return;
          }

          const state = talkingSequence[currentIndex];
          if (window.playExpression) {
            window.playExpression(state.name);
          }

          setTimeout(() => {
            currentIndex++;
            playNextFrame();
          }, state.duration);
        }

        playNextFrame();
      } else if (window.setMouthValue) {
        // 使用参数控制的智能说话
        const mouthValues = [0, 0.3, 0.7, 1.0, 0.5, 0.8, 0.2, 0.9, 0.4, 0];
        let index = 0;

        const talkInterval = setInterval(() => {
          window.setMouthValue(mouthValues[index % mouthValues.length]);
          index++;
          if (index >= mouthValues.length * 2) {
            clearInterval(talkInterval);
            window.setMouthValue(0);
            logMessage('💬 智能说话完成', 'success');
            isTalking = false;
          }
        }, 150);
      } else {
        logMessage('❌ 没有可用的嘴部控制方法', 'error');
        isTalking = false;
      }
    };

    window.randomTalk = function () {
      logMessage('💬 开始随机说话...');
      if (isTalking) return;
      const model = window.getCurrentCDNModel();
      if (!model) {
        logMessage('❌ 模型未就绪', 'error');
        return;
      }
      isTalking = true;
      if (availableExpressions.some((e) => e.name.startsWith('mouth_'))) {
        const states = [
          'mouth_close',
          'mouth_slight',
          'mouth_half',
          'mouth_open',
        ];
        let count = 0;
        function playRandom() {
          if (count++ >= 15) {
            isTalking = false;
            window.playExpression('mouth_close');
            return;
          }
          const state = states[Math.floor(Math.random() * states.length)];
          window.playExpression(state);
          setTimeout(playRandom, Math.random() * 150 + 100);
        }
        playRandom();
      } else if (window.setMouthValue) {
        let count = 0;
        const interval = setInterval(() => {
          window.setMouthValue(Math.random());
          if (count++ >= 15) {
            clearInterval(interval);
            window.setMouthValue(0);
            isTalking = false;
          }
        }, 150);
      } else {
        isTalking = false;
      }
    };

    window.closeMouth = function () {
      logMessage('🤐 闭嘴...');
      if (
        window.playExpression &&
        availableExpressions.some((e) => e.name === 'mouth_close')
      ) {
        window.playExpression('mouth_close');
      } else if (window.setMouthValue) {
        window.setMouthValue(0);
      }
    };

    logMessage('🌟 智能说话版 Live2D Widget 初始化完成!');
    logMessage('💡 使用方法:');
    logMessage('   loadCDNModel("模型名") - 加载CDN模型 (如: ariu, xiaoeemo)');
    logMessage('   smartTalk() - 智能说话');
    logMessage('   randomTalk() - 随机说话');
    logMessage('   closeMouth() - 闭嘴');
    logMessage('   listExpressions() - 列出可用表情');
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
