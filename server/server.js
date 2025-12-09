/**
 * 食堂评价系统 - 后端服务
 * 功能：菜单管理、评分评价、神秘人权重、数据汇总
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());

// 数据文件路径
const DATA_DIR = path.join(__dirname, 'data');
const MENU_FILE = path.join(DATA_DIR, 'menu.json');
const RATINGS_FILE = path.join(DATA_DIR, 'ratings.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 初始化数据文件
function initDataFiles() {
    if (!fs.existsSync(MENU_FILE)) {
        fs.writeFileSync(MENU_FILE, JSON.stringify({ weekMenu: [] }));
    }
    if (!fs.existsSync(RATINGS_FILE)) {
        fs.writeFileSync(RATINGS_FILE, JSON.stringify({ ratings: [] }));
    }
    if (!fs.existsSync(CONFIG_FILE)) {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify({ 
            adminPassword: '0111ll',
            mysteryCode: '8888'  // 默认神秘人口令
        }));
    }
}

initDataFiles();

// 读取数据
function readData(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error(`读取文件失败: ${file}`, error);
        return null;
    }
}

// 写入数据
function writeData(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`写入文件失败: ${file}`, error);
        return false;
    }
}

// ==================== API 路由 ====================

// 获取菜单
app.get('/api/menu', (req, res) => {
    const data = readData(MENU_FILE);
    res.json(data || { weekMenu: [] });
});

// 保存菜单（需要管理员验证）
app.post('/api/menu', (req, res) => {
    const { password, weekMenu } = req.body;
    const config = readData(CONFIG_FILE);
    
    if (password !== config.adminPassword) {
        return res.status(401).json({ error: '管理员密码错误' });
    }
    
    if (writeData(MENU_FILE, { weekMenu })) {
        res.json({ success: true, message: '菜单保存成功' });
    } else {
        res.status(500).json({ error: '保存失败' });
    }
});

// 获取所有评分数据（需要管理员验证）
app.post('/api/ratings/all', (req, res) => {
    const { password } = req.body;
    const config = readData(CONFIG_FILE);
    
    if (password !== config.adminPassword) {
        return res.status(401).json({ error: '管理员密码错误' });
    }
    
    const data = readData(RATINGS_FILE);
    res.json(data || { ratings: [] });
});

// 获取汇总数据（需要管理员验证）
app.post('/api/ratings/summary', (req, res) => {
    const { password } = req.body;
    const config = readData(CONFIG_FILE);
    
    if (password !== config.adminPassword) {
        return res.status(401).json({ error: '管理员密码错误' });
    }
    
    const ratingsData = readData(RATINGS_FILE);
    const menuData = readData(MENU_FILE);
    
    if (!ratingsData || !menuData) {
        return res.json({ summary: [] });
    }
    
    // 汇总每道菜的评分
    const summary = {};
    
    ratingsData.ratings.forEach(rating => {
        const key = `${rating.day}_${rating.mealType}_${rating.dishName}`;
        if (!summary[key]) {
            summary[key] = {
                date: rating.day,
                mealType: rating.mealType,
                dishName: rating.dishName,
                totalScore: 0,
                weightedCount: 0,
                comments: []
            };
        }
        
        // 神秘人权重为3
        const weight = rating.isMystery ? 3 : 1;
        summary[key].totalScore += rating.score * weight;
        summary[key].weightedCount += weight;
        
        if (rating.comment && rating.comment.trim()) {
            summary[key].comments.push({
                comment: rating.comment,
                isMystery: rating.isMystery,
                time: rating.timestamp
            });
        }
    });
    
    // 计算平均分
    const summaryList = Object.values(summary).map(item => ({
        ...item,
        averageScore: item.weightedCount > 0 
            ? (item.totalScore / item.weightedCount).toFixed(1) 
            : 0,
        ratingCount: ratingsData.ratings.filter(
            r => r.day === item.date && 
                 r.mealType === item.mealType && 
                 r.dishName === item.dishName
        ).length
    }));
    
    res.json({ summary: summaryList });
});

// 提交评分（公开接口）
app.post('/api/ratings/submit', (req, res) => {
    const { day, mealType, dishName, score, comment, isMystery, visitorId, dateKey } = req.body;
    
    if (!day || !mealType || !dishName || score === undefined) {
        return res.status(400).json({ error: '缺少必要参数' });
    }
    
    if (score < 1 || score > 10) {
        return res.status(400).json({ error: '评分必须在1-10之间' });
    }
    
    const ratingsData = readData(RATINGS_FILE);
    
    // 检查今天是否已评分（基于访客ID、日期和菜品）
    const existingRating = ratingsData.ratings.find(
        r => r.visitorId === visitorId && 
             r.day === day && 
             r.mealType === mealType && 
             r.dishName === dishName &&
             r.dateKey === dateKey
    );
    
    if (existingRating) {
        return res.status(400).json({ error: '您今天已对该菜品评过分了' });
    }
    
    ratingsData.ratings.push({
        id: Date.now().toString(),
        day,
        dateKey,
        mealType,
        dishName,
        score: Number(score),
        comment: comment || '',
        isMystery: Boolean(isMystery),
        visitorId,
        timestamp: new Date().toISOString()
    });
    
    if (writeData(RATINGS_FILE, ratingsData)) {
        res.json({ success: true, message: '评分提交成功' });
    } else {
        res.status(500).json({ error: '提交失败' });
    }
});

// 验证神秘人口令
app.post('/api/mystery/verify', (req, res) => {
    const { code } = req.body;
    const config = readData(CONFIG_FILE);
    
    if (code === config.mysteryCode) {
        res.json({ success: true, message: '验证成功，您已获得神秘人特权！' });
    } else {
        res.status(401).json({ error: '口令错误' });
    }
});

// 设置神秘人口令（需要管理员验证）
app.post('/api/mystery/setcode', (req, res) => {
    const { password, newCode } = req.body;
    const config = readData(CONFIG_FILE);
    
    if (password !== config.adminPassword) {
        return res.status(401).json({ error: '管理员密码错误' });
    }
    
    config.mysteryCode = newCode;
    
    if (writeData(CONFIG_FILE, config)) {
        res.json({ success: true, message: '神秘人口令设置成功' });
    } else {
        res.status(500).json({ error: '设置失败' });
    }
});

// 获取当前神秘人口令（需要管理员验证）
app.post('/api/mystery/getcode', (req, res) => {
    const { password } = req.body;
    const config = readData(CONFIG_FILE);
    
    if (password !== config.adminPassword) {
        return res.status(401).json({ error: '管理员密码错误' });
    }
    
    res.json({ code: config.mysteryCode });
});

// 验证管理员密码
app.post('/api/admin/verify', (req, res) => {
    const { password } = req.body;
    const config = readData(CONFIG_FILE);
    
    if (password === config.adminPassword) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: '密码错误' });
    }
});

// 清除评分数据（需要管理员验证）
app.post('/api/ratings/clear', (req, res) => {
    const { password } = req.body;
    const config = readData(CONFIG_FILE);
    
    if (password !== config.adminPassword) {
        return res.status(401).json({ error: '管理员密码错误' });
    }
    
    if (writeData(RATINGS_FILE, { ratings: [] })) {
        res.json({ success: true, message: '评分数据已清除' });
    } else {
        res.status(500).json({ error: '清除失败' });
    }
});

// 清除菜单数据（需要管理员验证）
app.post('/api/menu/clear', (req, res) => {
    const { password } = req.body;
    const config = readData(CONFIG_FILE);
    
    if (password !== config.adminPassword) {
        return res.status(401).json({ error: '管理员密码错误' });
    }
    
    if (writeData(MENU_FILE, { weekMenu: [] })) {
        res.json({ success: true, message: '菜单数据已清除' });
    } else {
        res.status(500).json({ error: '清除失败' });
    }
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`🍽️  食堂评价系统后端服务已启动`);
    console.log(`📡 服务地址: http://localhost:${PORT}`);
    console.log(`🔑 管理员密码: 0111ll`);
    console.log(`🎭 默认神秘人口令: 8888`);
});
