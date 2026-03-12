/**
 * 自定义 Expo Web HTML 文档
 *
 * 关键修复：
 * - viewport-fit=cover 使 iOS Safari 报告安全区域 insets
 * - 100dvh 替代 100% 解决移动浏览器地址栏/底栏遮挡
 * - env(safe-area-inset-*) CSS 变量确保全面屏兼容
 */
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="zh">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5, viewport-fit=cover"
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: responsiveCSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveCSS = `
/* ── 全面屏 & 移动浏览器兼容 ── */
html, body, #root {
  height: 100%;
  height: 100dvh;         /* 动态视口高度，排除移动浏览器 chrome */
  margin: 0;
  padding: 0;
  overflow: hidden;
  -webkit-overflow-scrolling: touch;
}

#root {
  display: flex;
  flex-direction: column;
}

/* 确保安全区域 padding 生效（iOS Safari / 全面屏设备） */
body {
  padding-top: env(safe-area-inset-top);
  padding-right: env(safe-area-inset-right);
  padding-left: env(safe-area-inset-left);
  /* 底部 padding 由 TabBar 组件控制，不在 body 上设置 */
}

/* 兼容旧版 iOS Safari（constant 前缀） */
@supports (padding-top: constant(safe-area-inset-top)) {
  body {
    padding-top: constant(safe-area-inset-top);
    padding-right: constant(safe-area-inset-right);
    padding-left: constant(safe-area-inset-left);
  }
}
`;
