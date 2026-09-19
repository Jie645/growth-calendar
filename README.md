# 成长日历 · Web MVP

一个以日历为核心界面的轻量化个人成长记录软件，基于项目计划书实现。

## 已实现功能

- 月历视图与日期状态
- 实时天气挂件：浏览器定位优先，失败时自动使用网络定位
- 公历节日、农历节日与二十四节气标注（2020—2045）
- 单输入框快速记录，保留低门槛体验
- 图片选择、拖拽、本地压缩与预览
- 日期记录编辑、补记与删除
- 按时间自动归档的成长时间线
- 记录搜索与随机回顾
- 连续记录、最长连续、月记录密度
- 近 12 周热力图与年度月度记录图
- IndexedDB 本地持久化
- JSON 数据导入与导出
- PWA 清单与离线缓存
- 移动端响应式布局

## 启动方式

### 方式一：双击启动

运行目录中的 `start.ps1`，浏览器会自动打开：

`http://localhost:8000`

### 方式二：手动启动

在当前目录运行：

```powershell
python -m http.server 8000
```

然后访问 `http://localhost:8000`。

### 方式三：直接打开

双击 `index.html` 也可以使用核心功能。由于浏览器安全限制，直接以 `file://` 打开时，PWA 离线能力不会启用，但本地记录功能仍然可用。

## 示例数据

访问 `http://localhost:8000/?demo=1&v=5` 可以直接查看示例模式。

也可以在首次欢迎页或“数据管理”中加载示例数据。

## 数据说明

记录默认保存在当前浏览器的 IndexedDB 中，不会上传到服务器。天气功能会使用浏览器定位或网络定位获取当前位置，并向 Open-Meteo 请求当地天气；位置和天气结果会短暂缓存在浏览器中。建议定期通过“数据管理 → 导出数据备份”保存 JSON 文件。

## 文件结构

```text
growth-calendar/
├─ index.html
├─ styles.css
├─ calendar-events.js
├─ store.js
├─ ui.js
├─ app.js
├─ manifest.webmanifest
├─ sw.js
├─ icon.svg
├─ start.ps1
├─ start.bat
└─ README.md
```

## 技术说明

前端使用原生 HTML、CSS 与 JavaScript，无构建步骤和第三方运行依赖。数据层优先使用 IndexedDB，在不可用环境下自动降级到 localStorage。





