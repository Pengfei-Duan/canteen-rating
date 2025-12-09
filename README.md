# 食堂菜品评价系统

一个支持多人联网同步的食堂菜品评价系统，包含菜单管理、匿名评分、神秘人特权等功能。

## 📋 功能介绍

### 用户功能
- **菜品评价**：对每周的早餐、午餐菜品进行1-10分评分
- **文字评价**：可选填写文字评价
- **匿名评价**：所有评价匿名提交，保护隐私
- **神秘人模式**：输入特定口令后，评分权重提升为普通用户的3倍

### 管理功能
- **菜单录入**：录入每周的早餐、午餐菜单
- **评分汇总**：自动汇总所有菜品的平均分和评价
- **神秘人口令设置**：设置和修改神秘人验证口令
- **数据清除**：可清除评分数据或菜单数据

## 🔐 默认密码

- **管理后台密码**：`0111ll`
- **神秘人默认口令**：`8888`（可在后台修改）

## 🚀 部署指南

### 方式一：本地运行（测试用）

#### 1. 启动后端服务

```bash
cd server
npm install
npm start
```

后端将在 http://localhost:3001 启动

#### 2. 启动前端应用

```bash
cd client
npm install
npm start
```

前端将在 http://localhost:3000 启动

### 方式二：部署到云服务器（推荐生产使用）

#### 选项A：部署到 Render.com（免费）

1. 在 [Render.com](https://render.com) 注册账号

2. **部署后端**：
   - 创建新的 Web Service
   - 连接您的 GitHub 仓库
   - 设置 Root Directory 为 `server`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - 记下部署后的 URL（如 `https://xxx.onrender.com`）

3. **部署前端**：
   - 创建新的 Static Site
   - 设置 Root Directory 为 `client`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `build`
   - 添加环境变量：`REACT_APP_API_URL=后端URL`

#### 选项B：部署到 Vercel（免费）

1. 在 [Vercel.com](https://vercel.com) 注册账号

2. **部署后端**（需要添加 vercel.json）：
   ```json
   {
     "version": 2,
     "builds": [{"src": "server.js", "use": "@vercel/node"}],
     "routes": [{"src": "/(.*)", "dest": "server.js"}]
   }
   ```

3. **部署前端**：
   - Import 项目，选择 client 目录
   - 添加环境变量 `REACT_APP_API_URL`

#### 选项C：部署到自有服务器

1. **安装 Node.js**（建议 v18+）

2. **上传代码到服务器**

3. **安装 PM2 进程管理器**：
   ```bash
   npm install -g pm2
   ```

4. **启动后端**：
   ```bash
   cd server
   npm install
   pm2 start server.js --name canteen-api
   ```

5. **构建前端**：
   ```bash
   cd client
   npm install
   REACT_APP_API_URL=http://你的服务器IP:3001 npm run build
   ```

6. **配置 Nginx**：
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       # 前端静态文件
       location / {
           root /path/to/client/build;
           try_files $uri /index.html;
       }
       
       # API 代理
       location /api {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
       }
   }
   ```

### 方式三：使用 Docker 部署

创建 `docker-compose.yml`：

```yaml
version: '3'
services:
  backend:
    build: ./server
    ports:
      - "3001:3001"
    volumes:
      - ./data:/app/data
  
  frontend:
    build: ./client
    ports:
      - "80:80"
    environment:
      - REACT_APP_API_URL=http://localhost:3001
    depends_on:
      - backend
```

然后运行：
```bash
docker-compose up -d
```

## 📱 使用说明

### 普通用户
1. 打开系统链接
2. 在"评价"页面查看本周菜单
3. 为每道菜品选择1-10分评分
4. 可选填写文字评价
5. 点击"提交评价"

### 神秘人用户
1. 点击"神秘人"标签
2. 输入管理员提供的数字口令
3. 验证成功后返回评价页面
4. 此时您的评分权重为普通用户的3倍

### 管理员
1. 点击"后台"标签
2. 输入管理密码：`0111ll`
3. 可进行以下操作：
   - 录入/修改周菜单
   - 设置神秘人口令
   - 查看评分汇总
   - 清除数据

## 📁 项目结构

```
canteen-rating/
├── server/              # 后端服务
│   ├── server.js        # 主服务文件
│   ├── package.json     # 依赖配置
│   └── data/            # 数据存储目录（自动生成）
│       ├── menu.json    # 菜单数据
│       ├── ratings.json # 评分数据
│       └── config.json  # 配置数据
│
├── client/              # 前端应用
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.js       # 主组件
│   │   ├── App.css      # 样式文件
│   │   └── index.js     # 入口文件
│   └── package.json
│
└── README.md            # 本说明文档
```

## ⚙️ API 接口说明

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/menu` | GET | 获取菜单 |
| `/api/menu` | POST | 保存菜单（需密码） |
| `/api/menu/clear` | POST | 清除菜单（需密码） |
| `/api/ratings/submit` | POST | 提交评分 |
| `/api/ratings/summary` | POST | 获取汇总（需密码） |
| `/api/ratings/clear` | POST | 清除评分（需密码） |
| `/api/mystery/verify` | POST | 验证神秘人口令 |
| `/api/mystery/setcode` | POST | 设置神秘人口令（需密码） |
| `/api/admin/verify` | POST | 验证管理密码 |

## 🔧 环境变量

### 后端
- `PORT`：服务端口（默认 3001）

### 前端
- `REACT_APP_API_URL`：后端 API 地址（默认 http://localhost:3001）

## 📝 注意事项

1. **数据持久化**：数据存储在 `server/data/` 目录下的 JSON 文件中，请定期备份

2. **安全建议**：
   - 生产环境请修改默认管理密码
   - 建议配置 HTTPS
   - 考虑添加访问频率限制

3. **扩展性**：如需更高性能，可将 JSON 文件存储替换为数据库（MongoDB/PostgreSQL）

## 🤝 技术支持

如有问题，请检查：
1. Node.js 版本是否 >= 16
2. 端口是否被占用
3. 前后端 API 地址配置是否正确
4. 网络防火墙是否放行相应端口
