/**



 * Copyright(c) Live2D Inc. All rights reserved.



 *



 * Use of this source code is governed by the Live2D Open Software license



 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.



 */

import { LAppDelegate } from './lappdelegate';

// 导入所有需要暴露到全局的 Cubism 5 类

import { CubismFramework, LogLevel } from '@framework/live2dcubismframework';

import { CubismMotion } from '@framework/motion/cubismmotion';

import { CubismMotionQueueManager } from '@framework/motion/cubismmotionqueuemanager';

import { CubismModel } from '@framework/model/cubismmodel';

import { CubismModelSettingJson } from '@framework/cubismmodelsettingjson';

import { CubismExpressionMotion } from '@framework/motion/cubismexpressionmotion';

import { CubismRenderer_WebGL } from '@framework/rendering/cubismrenderer_webgl';

import { CubismMatrix44 } from '@framework/math/cubismmatrix44';

import { CubismViewMatrix } from '@framework/math/cubismviewmatrix';

import { csmVector } from '@framework/type/csmvector';

import { csmString } from '@framework/type/csmstring';

import { csmMap } from '@framework/type/csmmap';

// 暴露所有 Cubism 5 类到全局

declare global {
  interface Window {
    Live2DCubismFramework: {
      CubismFramework: typeof CubismFramework;

      CubismMotion: typeof CubismMotion;

      CubismMotionQueueManager: typeof CubismMotionQueueManager;

      CubismModel: typeof CubismModel;

      CubismModelSettingJson: typeof CubismModelSettingJson;

      CubismExpressionMotion: typeof CubismExpressionMotion;

      CubismRenderer_WebGL: typeof CubismRenderer_WebGL;

      CubismMatrix44: typeof CubismMatrix44;

      CubismViewMatrix: typeof CubismViewMatrix;

      csmVector: typeof csmVector;

      csmString: typeof csmString;

      csmMap: typeof csmMap;

      LogLevel: typeof LogLevel;
    };
  }
}

// 创建全局 Live2DCubismFramework 对象

window.Live2DCubismFramework = {
  CubismFramework,

  CubismMotion,

  CubismMotionQueueManager,

  CubismModel,

  CubismModelSettingJson,

  CubismExpressionMotion,

  CubismRenderer_WebGL,

  CubismMatrix44,

  CubismViewMatrix,

  csmVector,

  csmString,

  csmMap,

  LogLevel,
};

/**



 * ブラウザロード後の処理



 */

window.addEventListener(
  'load',

  (): void => {
    // Initialize WebGL and create the application instance

    if (!LAppDelegate.getInstance().initialize()) {
      return;
    }

    LAppDelegate.getInstance().run();
  },

  { passive: true },
);

/**



 * 終了時の処理



 */

window.addEventListener(
  'beforeunload',

  (): void => LAppDelegate.releaseInstance(),

  { passive: true },
);

