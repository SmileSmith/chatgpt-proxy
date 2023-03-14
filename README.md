# CHATGPT 代理服务

## 介绍

本项目基于 nodejs 版本 [chatgpt-api](https://github.com/transitive-bullshit/chatgpt-api) ，使用 express 框架，实现了一个简单的代理服务，支持代理 chatgpt 的官方 api 版本和爬虫版本。

### 参考文档

[账号注册](https://cloud.tencent.com/developer/article/2190154)
[获取openai的ApiKey](https://platform.openai.com/account/api-keys)

## 环境

- nodejs >= 18
- 网络：需要魔法和梯子
- 系统：windows，爬虫版本需要 windows 版本的 Chrome 浏览器（只需要 API 版本的忽略）
- 软件：Chrome 浏览器，爬虫版本需要安装 chromedriver（只需要 API 版本的忽略）

## 安装教程

### 1. clone 项目到服务器上

### 2. 安装依赖

```bash
## 全局安装nodeman
npm i -g nodeman

## 安装项目依赖
npm install
```

### 3. 修改配置文件

复制 example.env 文件为.env 文件，修改.env 文件中的配置

1. 优先级 1：接口传入 `apiKey`, 使用用户传入的 apiKey 调用官方 API
2. 优先级 2：本地配置的 `OPENAI_API_KEY` ，使用服务侧配置的兜底 apiKey 调用官方 API
3. 优先级 3：`OPENAI_ACCOUNT_EMAIL、OPENAI_ACCOUNT_PASS`，如果没有 openai 的 key，可以使用爬虫版本，需要提前安装 chrome 浏览器

### 4. 启动服务

```bash
npm run server
```

## 常见问题


### 1. windows的代理服务器

建议去tx云、ali云等云服务商申请一个海外的windows服务器，然后在服务器上部署代理服务，也可以自己搭梯子

已tx云为例，首尔地区，2核2GB的云服务器，每年费用在700左右

<img width="647" alt="image" src="https://user-images.githubusercontent.com/17798955/224979451-b108809a-2258-4d5e-bfe2-57d31c0ea555.png">


### 2. 没有打字效果

需要看看是否是 nginx 之类的代理服务配置问题。nginx 默认配置的 `proxy_buffering` 是开启的 `4k`，会导致返回的数据先在ng积压到4k或者链接关闭才会返回到客户端，建议关闭proxy_buffering：

```nginx
    location /api {
        proxy_pass   http://localhost:8000/api;
        proxy_buffering off;
    }
```

## 参与贡献

1. Fork 本仓库
2. 新建 Feat_xxx 分支
3. 提交代码
4. 新建 Pull Request
