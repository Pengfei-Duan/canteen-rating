import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const getVisitorId = () => {
  let id = localStorage.getItem('canteen_visitor_id');
  if (!id) {
    id = 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('canteen_visitor_id', id);
  }
  return id;
};

const getTodayInfo = () => {
  const now = new Date();
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((now - startOfYear) / 86400000);
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return {
    year, month, date,
    weekday: weekdays[now.getDay()],
    weekNumber,
    dateStr: `${year}年${month}月${date}日${weekdays[now.getDay()]}`,
    dayKey: `${year}-${month}-${date}`,
    dayIndex: now.getDay()
  };
};

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五'];
const MEAL_TYPES = ['早餐', '午餐'];

const DishInput = React.memo(({ value, onChange, onRemove }) => {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef(null);
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setLocalValue(value);
  }, [value]);
  return (
    <div className="dish-input-row">
      <input ref={inputRef} type="text" value={localValue}
        onChange={e => setLocalValue(e.target.value)}
        onBlur={() => localValue !== value && onChange(localValue)}
        placeholder="菜品名称" />
      <button type="button" onClick={onRemove} className="remove-btn">×</button>
    </div>
  );
});

export default function App() {
  const [view, setView] = useState('home');
  const [menu, setMenu] = useState([]);
  const [isMystery, setIsMystery] = useState(false);
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [adminPwd, setAdminPwd] = useState('');
  const [mysteryCode, setMysteryCode] = useState('');
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [newCode, setNewCode] = useState('');
  const [currentCode, setCurrentCode] = useState('');
  const [editMenu, setEditMenu] = useState([]);
  const [allRatings, setAllRatings] = useState([]);
  const [showWeekMenu, setShowWeekMenu] = useState(false);
  const [summary, setSummary] = useState([]);

  const visitorId = getVisitorId();
  const todayInfo = getTodayInfo();

  const showMsg = (text, type = 'info') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 3000);
  };

  // 加载菜单
  const loadMenu = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/menu`);
      const data = await res.json();
      setMenu(data.weekMenu || []);
    } catch (error) {
      console.error('加载菜单失败:', error);
    }
  }, []);

  useEffect(() => { loadMenu(); }, [loadMenu]);

  const getTodayWeekday = () => {
    const day = todayInfo.dayIndex;
    if (day === 0 || day === 6) return null;
    return WEEKDAYS[day - 1];
  };

  const getTodayMenu = () => {
    const wd = getTodayWeekday();
    return wd ? menu.find(m => m.day === wd) : null;
  };

  const getDishRating = (day, mealType, dishName) => {
    const dr = allRatings.filter(r => r.day === day && r.mealType === mealType && r.dishName === dishName);
    if (!dr.length) return null;
    let ts = 0, tw = 0;
    dr.forEach(r => { const w = r.isMystery ? 3 : 1; ts += r.score * w; tw += w; });
    return (ts / tw).toFixed(1);
  };

  const hasRatedToday = (day, mealType, dishName) => allRatings.some(r =>
    r.visitorId === visitorId && r.day === day && r.mealType === mealType && 
    r.dishName === dishName && r.dateKey === todayInfo.dayKey
  );

  const submitRating = async (day, mealType, dishName, score) => {
    if (hasRatedToday(day, mealType, dishName)) {
      showMsg('您今天已对该菜品评过分了', 'error');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/ratings/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day, mealType, dishName, score, isMystery, visitorId, dateKey: todayInfo.dayKey
        })
      });
      const data = await res.json();
      if (res.ok) {
        showMsg(isMystery ? '🎭 神秘人评分成功！（权重×3）' : '评分成功！', 'success');
        setAllRatings(prev => [...prev, {
          day, mealType, dishName, score, isMystery, visitorId, dateKey: todayInfo.dayKey
        }]);
      } else {
        showMsg(data.error || '提交失败', 'error');
      }
    } catch (error) {
      showMsg('网络错误', 'error');
    }
  };

  const getTopDish = (mealType) => {
    const wd = getTodayWeekday();
    const tm = menu.find(m => m.day === wd);
    if (!tm) return null;
    const meal = tm.meals.find(m => m.type === mealType);
    if (!meal?.dishes.length) return null;
    let top = null, topScore = 0;
    meal.dishes.forEach(dish => {
      const r = getDishRating(wd, mealType, dish);
      if (r && parseFloat(r) > topScore) { topScore = parseFloat(r); top = { name: dish, score: r }; }
    });
    return top;
  };

  const verifyMystery = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/mystery/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: mysteryCode })
      });
      if (res.ok) {
        setIsMystery(true);
        showMsg('🎭 验证成功！评分权重×3', 'success');
        setView('home');
      } else {
        showMsg('口令错误', 'error');
      }
    } catch (error) {
      showMsg('网络错误', 'error');
    }
  };

  const adminLogin = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPwd })
      });
      if (res.ok) {
        setAdminLoggedIn(true);
        showMsg('登录成功', 'success');
        loadSummary();
        loadCurrentMysteryCode();
        initEditMenu();
      } else {
        showMsg('密码错误', 'error');
      }
    } catch (error) {
      showMsg('网络错误', 'error');
    }
  };

  const loadSummary = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/ratings/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPwd })
      });
      const data = await res.json();
      if (res.ok) setSummary(data.summary || []);
    } catch (error) {
      console.error('加载汇总失败');
    }
  };

  const loadCurrentMysteryCode = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/mystery/getcode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPwd })
      });
      const data = await res.json();
      if (res.ok) setCurrentCode(data.code);
    } catch (error) {
      console.error('加载口令失败');
    }
  };

  const initEditMenu = useCallback(() => {
    if (menu.length > 0) {
      setEditMenu(JSON.parse(JSON.stringify(menu)));
    } else {
      setEditMenu(WEEKDAYS.map(day => ({ day, meals: MEAL_TYPES.map(type => ({ type, dishes: [''] })) })));
    }
  }, [menu]);

  const updateDish = useCallback((di, mi, dishi, val) => {
    setEditMenu(prev => { const m = JSON.parse(JSON.stringify(prev)); m[di].meals[mi].dishes[dishi] = val; return m; });
  }, []);
  const addDish = useCallback((di, mi) => {
    setEditMenu(prev => { const m = JSON.parse(JSON.stringify(prev)); m[di].meals[mi].dishes.push(''); return m; });
  }, []);
  const removeDish = useCallback((di, mi, dishi) => {
    setEditMenu(prev => { const m = JSON.parse(JSON.stringify(prev)); m[di].meals[mi].dishes.splice(dishi, 1); return m; });
  }, []);

  const saveMenu = async () => {
    const cleaned = editMenu.map(d => ({ ...d, meals: d.meals.map(m => ({ ...m, dishes: m.dishes.filter(x => x.trim()) })) }));
    try {
      const res = await fetch(`${API_BASE}/api/menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPwd, weekMenu: cleaned })
      });
      if (res.ok) {
        setMenu(cleaned);
        showMsg('菜单保存成功', 'success');
      } else {
        showMsg('保存失败', 'error');
      }
    } catch (error) {
      showMsg('网络错误', 'error');
    }
  };

  const setMysteryCodeApi = async () => {
    if (!newCode.trim()) { showMsg('请输入新口令', 'error'); return; }
    try {
      const res = await fetch(`${API_BASE}/api/mystery/setcode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPwd, newCode })
      });
      if (res.ok) {
        setCurrentCode(newCode);
        setNewCode('');
        showMsg('口令设置成功', 'success');
      } else {
        showMsg('设置失败', 'error');
      }
    } catch (error) {
      showMsg('网络错误', 'error');
    }
  };

  const clearRatings = async () => {
    if (!window.confirm('确定清除所有评分？')) return;
    try {
      const res = await fetch(`${API_BASE}/api/ratings/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPwd })
      });
      if (res.ok) {
        setAllRatings([]);
        setSummary([]);
        showMsg('已清除', 'success');
      }
    } catch (error) {
      showMsg('网络错误', 'error');
    }
  };

  const clearMenu = async () => {
    if (!window.confirm('确定清除所有菜单？')) return;
    try {
      const res = await fetch(`${API_BASE}/api/menu/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPwd })
      });
      if (res.ok) {
        setMenu([]);
        initEditMenu();
        showMsg('已清除', 'success');
      }
    } catch (error) {
      showMsg('网络错误', 'error');
    }
  };

  const RatingButtons = ({ day, mealType, dishName }) => {
    const rated = hasRatedToday(day, mealType, dishName);
    if (rated) return <span className="rated-badge">已评分</span>;
    return (
      <div className="rating-buttons">
        {[1,2,3,4,5,6,7,8,9,10].map(s => (
          <button key={s} type="button" className="score-btn"
            onClick={() => submitRating(day, mealType, dishName, s)}>{s}</button>
        ))}
      </div>
    );
  };

  const HomeView = () => {
    const todayMenu = getTodayMenu();
    const todayWeekday = getTodayWeekday();
    const topBreakfast = getTopDish('早餐');
    const topLunch = getTopDish('午餐');

    return (
      <div className="home-view">
        <section className="menu-card">
          <div className="card-header"><h2>本周菜单</h2></div>
          <div className="week-nav">
            <span className="week-number">第 {todayInfo.weekNumber} 周</span>
            <div className="nav-arrows">
              <button>‹</button><button>›</button>
            </div>
          </div>
          <div className="today-header">
            <span className="today-label">今日菜单</span>
            <span className="today-date">{todayInfo.dateStr}</span>
          </div>
          
          {todayMenu ? (
            <div className="today-menu">
              {todayMenu.meals.map((meal, mi) => meal.dishes.length > 0 && (
                <div key={mi} className="meal-section">
                  <div className="meal-title">{meal.type}</div>
                  <div className="dish-list">
                    {meal.dishes.map((dish, di) => {
                      const rating = getDishRating(todayWeekday, meal.type, dish);
                      return (
                        <div key={di} className="dish-item">
                          <span className="dish-name">{dish}</span>
                          {rating ? <span className="rating-score">★ {rating}</span> : <span className="no-rating">暂无评分</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-menu">{todayInfo.dayIndex === 0 || todayInfo.dayIndex === 6 ? '周末休息' : '今日暂无菜单'}</div>
          )}
          
          <button className="view-week-btn" onClick={() => setShowWeekMenu(!showWeekMenu)}>
            {showWeekMenu ? '收起本周菜单 ▲' : '查看本周菜单 ▼'}
          </button>
          
          {showWeekMenu && (
            <div className="week-menu">
              {menu.length === 0 ? <div className="no-data">暂无菜单数据</div> :
                menu.map((dm, di) => (
                  <div key={di} className="week-day">
                    <div className="day-header">{dm.day}</div>
                    {dm.meals.map((m, mi) => m.dishes.length > 0 && (
                      <div key={mi} className="week-meal">
                        <span className="meal-label">{m.type}：</span>
                        <span className="meal-dishes">{m.dishes.join('、')}</span>
                      </div>
                    ))}
                  </div>
                ))
              }
            </div>
          )}
        </section>

        <section className="rating-overview">
          <h2>评分概览</h2>
          <div className="overview-grid">
            <div className="overview-card">
              <div className="overview-title">早餐评分最高菜品</div>
              {topBreakfast ? (
                <div className="top-dish">
                  <span className="rank">1</span>
                  <div className="dish-info">
                    <span className="name">{topBreakfast.name}</span>
                    <span className="meal-time">{todayWeekday}早餐</span>
                  </div>
                  <span className="score">{topBreakfast.score}</span>
                </div>
              ) : <div className="no-data">暂无评分数据</div>}
            </div>
            <div className="overview-card">
              <div className="overview-title">午餐评分最高菜品</div>
              {topLunch ? (
                <div className="top-dish">
                  <span className="rank">1</span>
                  <div className="dish-info">
                    <span className="name">{topLunch.name}</span>
                    <span className="meal-time">{todayWeekday}午餐</span>
                  </div>
                  <span className="score">{topLunch.score}</span>
                </div>
              ) : <div className="no-data">暂无评分数据</div>}
            </div>
          </div>
        </section>

        <section className="rating-section">
          <h2>为今日菜品评分</h2>
          {isMystery && <div className="mystery-badge">🎭 神秘人模式 - 评分权重×3</div>}
          {todayMenu ? (
            <div className="rating-list">
              {todayMenu.meals.map((meal, mi) => meal.dishes.length > 0 && (
                <div key={mi} className="rating-meal">
                  <div className="meal-title">{meal.type}</div>
                  {meal.dishes.map((dish, di) => (
                    <div key={di} className="rating-item">
                      <span className="dish-name">{dish}</span>
                      <RatingButtons day={todayWeekday} mealType={meal.type} dishName={dish} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="no-menu">{todayInfo.dayIndex === 0 || todayInfo.dayIndex === 6 ? '周末休息，无需评分' : '今日暂无菜单，无法评分'}</div>
          )}
        </section>
      </div>
    );
  };

  const MysteryView = () => (
    <div className="mystery-view">
      <div className="mystery-card">
        <div className="mystery-icon">🎭</div>
        <h2>神秘人验证</h2>
        <p>输入数字口令获得特权功能</p>
        <p className="hint">神秘人的评分权重等于3名普通用户</p>
        {isMystery ? (
          <div className="mystery-active">
            <div className="check-icon">✓</div>
            <p>您已是神秘人身份</p>
            <button onClick={() => setIsMystery(false)}>退出神秘人模式</button>
          </div>
        ) : (
          <>
            <input type="password" placeholder="请输入数字口令" value={mysteryCode}
              onChange={e => setMysteryCode(e.target.value)} onKeyPress={e => e.key === 'Enter' && verifyMystery()} />
            <button className="verify-btn" onClick={verifyMystery}>验证口令</button>
          </>
        )}
      </div>
    </div>
  );

  const AdminView = () => {
    if (!adminLoggedIn) {
      return (
        <div className="admin-login">
          <div className="login-card">
            <div className="login-icon">🔐</div>
            <h2>后台管理</h2>
            <input type="password" placeholder="请输入管理密码" value={adminPwd}
              onChange={e => setAdminPwd(e.target.value)} onKeyPress={e => e.key === 'Enter' && adminLogin()} />
            <button onClick={adminLogin}>登录</button>
          </div>
        </div>
      );
    }

    return (
      <div className="admin-panel">
        <div className="admin-header">
          <h2>后台管理</h2>
          <button className="logout-btn" onClick={() => { setAdminLoggedIn(false); setAdminPwd(''); }}>退出登录</button>
        </div>

        <section className="admin-section">
          <h3>📋 本周菜单管理</h3>
          <div className="menu-editor">
            {editMenu.map((day, di) => (
              <div key={di} className="edit-day">
                <div className="day-title">{day.day}</div>
                {day.meals.map((meal, mi) => (
                  <div key={mi} className="edit-meal">
                    <span className="meal-label">{meal.type}</span>
                    <div className="dishes-list">
                      {meal.dishes.map((dish, dishi) => (
                        <DishInput key={`${di}-${mi}-${dishi}`} value={dish}
                          onChange={v => updateDish(di, mi, dishi, v)} onRemove={() => removeDish(di, mi, dishi)} />
                      ))}
                      <button type="button" className="add-btn" onClick={() => addDish(di, mi)}>+ 添加菜品</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <button className="save-btn" onClick={saveMenu}>💾 保存菜单</button>
        </section>

        <section className="admin-section">
          <h3>🎭 神秘人口令设置</h3>
          <p className="current-code">当前口令：<strong>{currentCode}</strong></p>
          <div className="code-input-row">
            <input type="text" value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="输入新口令" />
            <button onClick={setMysteryCodeApi}>设置新口令</button>
          </div>
        </section>

        <section className="admin-section">
          <h3>📊 评分汇总</h3>
          <button className="refresh-btn" onClick={loadSummary}>刷新数据</button>
          {summary.length === 0 ? <div className="no-data">暂无评分数据</div> : (
            <div className="summary-table">
              <table>
                <thead>
                  <tr><th>日期</th><th>餐次</th><th>菜品</th><th>平均分</th><th>评价人数</th></tr>
                </thead>
                <tbody>
                  {summary.map((item, i) => (
                    <tr key={i}>
                      <td>{item.date}</td>
                      <td>{item.mealType}</td>
                      <td>{item.dishName}</td>
                      <td className="score-cell">{item.averageScore}</td>
                      <td>{item.ratingCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="admin-section danger">
          <h3>⚠️ 数据管理</h3>
          <div className="danger-buttons">
            <button onClick={clearRatings}>🗑️ 清除评分数据</button>
            <button onClick={clearMenu}>🗑️ 清除菜单数据</button>
          </div>
        </section>
      </div>
    );
  };

  return (
    <div className="app">
      {msg.text && <div className={`toast ${msg.type}`}>{msg.text}</div>}
      
      <header className="header">
        <div className="logo">🍽️ 机关食堂评价系统</div>
        <nav className="nav">
          <button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}>首页</button>
          <button className={view === 'mystery' ? 'active' : ''} onClick={() => setView('mystery')}>
            神秘人 {isMystery && '🎭'}
          </button>
          <button className={view === 'admin' ? 'active' : ''} onClick={() => setView('admin')}>后台管理</button>
        </nav>
      </header>

      <main className="main">
        {view === 'home' && <HomeView />}
        {view === 'mystery' && <MysteryView />}
        {view === 'admin' && <AdminView />}
      </main>
    </div>
  );
}
