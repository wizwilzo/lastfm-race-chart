import React, { useState } from 'react';

const LastFmRaceChart = () => {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [chartData, setChartData] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [allWeeksData, setAllWeeksData] = useState([]);
  const [progress, setProgress] = useState('');
  const [animationInterval, setAnimationInterval] = useState(null);

  const colors = [
    '#FF1744', '#00E676', '#2979FF', '#FF9100', '#E91E63',
    '#00BCD4', '#FFEA00', '#D500F9', '#76FF03', '#FF5252',
    '#18FFFF', '#FFC107', '#651FFF', '#69F0AE', '#FF4081',
    '#FFD740', '#AA00FF', '#00E5FF', '#FF6E40', '#64FFDA',
    '#EEFF41', '#7C4DFF', '#FFAB40', '#1DE9B6', '#F50057',
    '#00B0FF', '#C6FF00', '#F4511E', '#40C4FF', '#CDDC39',
    '#6200EA', '#FFE57F', '#00C853', '#FF6F00', '#00ACC1',
    '#FDD835', '#D81B60', '#84FFFF', '#FF3D00', '#00897B',
    '#FFAB91', '#512DA8', '#8BC34A', '#E65100', '#0277BD',
    '#FFF176', '#C51162', '#26A69A', '#FF5722', '#0091EA'
  ];

  const fetchLastFmData = async () => {
    setLoading(true);
    setError('');
    setChartData(null);
    setCurrentWeek(0);
    setIsPlaying(false);
    setProgress('Getting user information...');

    try {
      const userInfoUrl = `/api/lastfm?method=user.getinfo&user=${username}`;
      const userResponse = await fetch(userInfoUrl);
      const userData = await userResponse.json();

      if (userData.error) {
        throw new Error(userData.message || 'User not found');
      }

      const joinTimestamp = parseInt(userData.user.registered.unixtime);
      const endTimestamp = Math.floor(Date.now() / 1000);
      const secondsInWeek = 604800;

      const DICT = {};
      const SET = new Set();
      const dateRanges = [];
      
      let currentTime = joinTimestamp;
      let weekNumber = 0;

      setProgress('Fetching weekly data...');

      let consecutiveErrors = 0;
      const maxConsecutiveErrors = 5;

      while (currentTime <= endTimestamp) {
        weekNumber++;
        
        try {
          const weekUrl = `/api/lastfm?method=user.getweeklyartistchart&user=${username}&from=${currentTime}&to=${currentTime + secondsInWeek}`;
          const response = await fetch(weekUrl);
          const data = await response.json();

          if (data.error) {
            console.warn('API Error at week', weekNumber, ':', data.message);
            consecutiveErrors++;
            
            const datetime = new Date(currentTime * 1000);
            dateRanges.push(datetime.toISOString().split('T')[0]);
            
            for (const artist in DICT) {
              while (DICT[artist].length <= weekNumber) {
                DICT[artist].push(0);
              }
            }
            
            currentTime += secondsInWeek;
            
            if (consecutiveErrors >= maxConsecutiveErrors) {
              console.error('Too many consecutive errors, stopping');
              break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }

          consecutiveErrors = 0;

          const datetime = new Date(currentTime * 1000);
          dateRanges.push(datetime.toISOString().split('T')[0]);

          setProgress(`Fetching week ${weekNumber}... (${dateRanges[dateRanges.length - 1]})`);

          if (data.weeklyartistchart && data.weeklyartistchart.artist) {
            for (const artistDict of data.weeklyartistchart.artist) {
              const currName = artistDict.name;
              SET.add(currName);

              if (!DICT[currName]) {
                DICT[currName] = new Array(weekNumber).fill(0);
              }

              DICT[currName].push(parseInt(artistDict.playcount));
            }
          }

          for (const artist in DICT) {
            while (DICT[artist].length <= weekNumber) {
              DICT[artist].push(0);
            }
          }

          currentTime += secondsInWeek;
          
          if (weekNumber % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (err) {
          console.error('Error fetching week', weekNumber, ':', err);
          consecutiveErrors++;
          
          const datetime = new Date(currentTime * 1000);
          dateRanges.push(datetime.toISOString().split('T')[0]);
          
          for (const artist in DICT) {
            while (DICT[artist].length <= weekNumber) {
              DICT[artist].push(0);
            }
          }
          
          currentTime += secondsInWeek;
          
          if (consecutiveErrors >= maxConsecutiveErrors) {
            console.error('Too many consecutive errors, stopping at:', dateRanges[dateRanges.length - 1]);
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      setProgress('Processing data...');

      for (const artistName in DICT) {
        for (let i = 1; i < DICT[artistName].length; i++) {
          DICT[artistName][i] = DICT[artistName][i - 1] + DICT[artistName][i];
        }
      }

      const weeklyChartData = [];
      for (let i = 0; i < dateRanges.length; i++) {
        const weekData = [];
        
        for (const artistName in DICT) {
          if (DICT[artistName][i] > 0) {
            weekData.push({
              name: artistName,
              value: DICT[artistName][i]
            });
          }
        }
        
        weekData.sort((a, b) => b.value - a.value);
        weeklyChartData.push({
          date: dateRanges[i],
          artists: weekData.slice(0, 15)
        });
      }

      setAllWeeksData(weeklyChartData);
      if (weeklyChartData.length > 0) {
        setChartData(weeklyChartData[0]);
      }
      setLoading(false);
      setProgress('');
    } catch (err) {
      setError(err.message || 'An error occurred while fetching data');
      setLoading(false);
      setProgress('');
    }
  };

  const startAnimation = () => {
    if (allWeeksData.length === 0) return;
    
    setIsPlaying(true);
    
    const interval = setInterval(() => {
      setCurrentWeek(prev => {
        const next = prev + 1;
        if (next >= allWeeksData.length) {
          setIsPlaying(false);
          clearInterval(interval);
          return prev;
        }
        setChartData(allWeeksData[next]);
        return next;
      });
    }, 66);
    
    setAnimationInterval(interval);
  };

  const pauseAnimation = () => {
    if (animationInterval) {
      clearInterval(animationInterval);
      setAnimationInterval(null);
    }
    setIsPlaying(false);
  };

  const resumeAnimation = () => {
    if (allWeeksData.length === 0 || currentWeek >= allWeeksData.length - 1) return;
    
    setIsPlaying(true);
    
    const interval = setInterval(() => {
      setCurrentWeek(prev => {
        const next = prev + 1;
        if (next >= allWeeksData.length) {
          setIsPlaying(false);
          clearInterval(interval);
          return prev;
        }
        setChartData(allWeeksData[next]);
        return next;
      });
    }, 66);
    
    setAnimationInterval(interval);
  };

  const handleGenerate = () => {
    if (username.trim()) {
      if (animationInterval) {
        clearInterval(animationInterval);
        setAnimationInterval(null);
      }
      setIsPlaying(false);
      setCurrentWeek(0);
      fetchLastFmData();
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #4c1d95, #1e3a8a, #312e81)', padding: '32px' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '48px', fontWeight: 'bold', color: 'white', textAlign: 'center', marginBottom: '16px' }}>
          Last.fm Racing Bar Chart
        </h1>
        <p style={{ color: '#bfdbfe', textAlign: 'center', marginBottom: '32px', fontSize: '18px' }}>
          Visualize your music listening journey over time
        </p>

        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', gap: '16px', maxWidth: '672px', margin: '0 auto' }}>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleGenerate()}
              placeholder="Enter your Last.fm username"
              style={{ flex: 1, padding: '16px 24px', borderRadius: '8px', fontSize: '18px', outline: 'none', border: 'none' }}
              disabled={loading}
            />
            <button
              onClick={handleGenerate}
              disabled={loading || !username.trim()}
              style={{
                padding: '16px 32px',
                background: 'linear-gradient(to right, #ec4899, #9333ea)',
                color: 'white',
                fontWeight: 'bold',
                borderRadius: '8px',
                border: 'none',
                cursor: loading || !username.trim() ? 'not-allowed' : 'pointer',
                opacity: loading || !username.trim() ? 0.5 : 1,
                fontSize: '18px'
              }}
            >
              {loading ? 'Loading...' : 'Generate'}
            </button>
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', color: 'white' }}>
            <div style={{ 
              display: 'inline-block',
              width: '64px',
              height: '64px',
              border: '4px solid transparent',
              borderTopColor: '#60a5fa',
              borderBottomColor: '#60a5fa',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '16px'
            }} />
            <p style={{ fontSize: '20px', fontWeight: '600' }}>Fetching your music data...</p>
            {progress && <p style={{ fontSize: '14px', color: '#93c5fd', marginTop: '8px' }}>{progress}</p>}
          </div>
        )}

        {error && (
          <div style={{ background: '#ef4444', color: 'white', padding: '24px', borderRadius: '8px', maxWidth: '672px', margin: '0 auto' }}>
            <p style={{ fontWeight: 'bold', fontSize: '18px' }}>Error:</p>
            <p>{error}</p>
          </div>
        )}

        {chartData && !loading && (
          <div style={{ background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(12px)', borderRadius: '16px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ color: 'white' }}>
                <h2 style={{ fontSize: '30px', fontWeight: 'bold' }}>{chartData.date}</h2>
                <p style={{ color: '#bfdbfe', fontSize: '18px' }}>Week {currentWeek + 1} of {allWeeksData.length}</p>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                {!isPlaying && currentWeek === 0 && (
                  <button
                    onClick={() => {
                      setCurrentWeek(0);
                      setChartData(allWeeksData[0]);
                      startAnimation();
                    }}
                    style={{
                      padding: '16px 32px',
                      background: '#22c55e',
                      color: 'white',
                      fontWeight: 'bold',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '18px'
                    }}
                  >
                    ▶ Play Animation
                  </button>
                )}
                {!isPlaying && currentWeek > 0 && currentWeek < allWeeksData.length - 1 && (
                  <button
                    onClick={resumeAnimation}
                    style={{
                      padding: '16px 32px',
                      background: '#22c55e',
                      color: 'white',
                      fontWeight: 'bold',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '18px'
                    }}
                  >
                    ▶ Resume
                  </button>
                )}
                {isPlaying && (
                  <button
                    onClick={pauseAnimation}
                    style={{
                      padding: '16px 32px',
                      background: '#eab308',
                      color: 'white',
                      fontWeight: 'bold',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '18px'
                    }}
                  >
                    ⏸ Pause
                  </button>
                )}
                {currentWeek > 0 && (
                  <button
                    onClick={() => {
                      if (animationInterval) {
                        clearInterval(animationInterval);
                        setAnimationInterval(null);
                      }
                      setIsPlaying(false);
                      setCurrentWeek(0);
                      setChartData(allWeeksData[0]);
                    }}
                    style={{
                      padding: '16px 32px',
                      background: '#ef4444',
                      color: 'white',
                      fontWeight: 'bold',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '18px'
                    }}
                  >
                    ↺ Restart
                  </button>
                )}
              </div>
            </div>

            {/* TIMELINE SLIDER */}
            <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '12px' }}>
              <input
                type="range"
                min={0}
                max={allWeeksData.length - 1}
                value={currentWeek}
                onChange={(e) => {
                  if (animationInterval) {
                    clearInterval(animationInterval);
                    setAnimationInterval(null);
                  }
                  setIsPlaying(false);
                  const week = parseInt(e.target.value);
                  setCurrentWeek(week);
                  setChartData(allWeeksData[week]);
                }}
                style={{
                  width: '100%',
                  height: '10px',
                  borderRadius: '5px',
                  outline: 'none',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                  appearance: 'none',
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((currentWeek / Math.max(1, allWeeksData.length - 1)) * 100)}%, rgba(255,255,255,0.2) ${((currentWeek / Math.max(1, allWeeksData.length - 1)) * 100)}%, rgba(255,255,255,0.2) 100%)`
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', color: '#bfdbfe', fontSize: '13px' }}>
                <span>Start: {allWeeksData[0]?.date}</span>
                <span>End: {allWeeksData[allWeeksData.length - 1]?.date}</span>
              </div>
            </div>

            <div style={{ background: 'rgba(17, 24, 39, 0.5)', borderRadius: '12px', padding: '16px' }}>
              <AnimatedBarChart data={chartData.artists} colors={colors} weekIndex={currentWeek} allWeeksData={allWeeksData} key={currentWeek === 0 ? `reset-${Date.now()}` : 'chart'} />
            </div>
          </div>
        )}
      </div>
      
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 4px solid white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }
        input[type="range"]::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 4px solid white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }
      `}</style>
    </div>
  );
};

const AnimatedBarChart = ({ data, colors, weekIndex, allWeeksData }) => {
  const [prevData, setPrevData] = React.useState(data);
  const [artistColors, setArtistColors] = React.useState({});
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const chartHeight = 700;

  // Calculate gold medal weeks by looking back through history
  const goldMedalWeeks = React.useMemo(() => {
    const weeks = {};
    if (data.length > 0 && allWeeksData && weekIndex >= 0) {
      const currentGoldArtist = data[0].name;
      let consecutiveWeeks = 0;
      
      // Count backwards from current week to find consecutive #1 weeks
      for (let i = weekIndex; i >= 0; i--) {
        if (allWeeksData[i].artists.length > 0 && allWeeksData[i].artists[0].name === currentGoldArtist) {
          consecutiveWeeks++;
        } else {
          break;
        }
      }
      
      weeks[currentGoldArtist] = consecutiveWeeks;
    }
    return weeks;
  }, [data, weekIndex, allWeeksData]);

  // Assign persistent colors to artists
  React.useEffect(() => {
    setArtistColors(prev => {
      const newColors = { ...prev };
      let colorIndex = Object.keys(prev).length;
      
      data.forEach((artist) => {
        if (!newColors[artist.name]) {
          newColors[artist.name] = colors[colorIndex % colors.length];
          colorIndex++;
        }
      });
      return newColors;
    });
  }, [data, colors]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setPrevData(data);
    }, 50);
    return () => clearTimeout(timer);
  }, [data]);

  const calculateRoundTicks = (max) => {
    if (max === 0) return [0, 100];
    
    const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
    
    let step;
    const ratio = max / magnitude;
    
    if (ratio <= 1) step = magnitude / 5;
    else if (ratio <= 2) step = magnitude / 2;
    else if (ratio <= 5) step = magnitude;
    else step = magnitude * 2;
    
    const ticks = [];
    let current = 0;
    
    while (current < max) {
      ticks.push(current);
      current += step;
    }
    
    ticks.push(current);
    
    if (ticks.length > 10) {
      step *= 2;
      ticks.length = 0;
      current = 0;
      while (current < max) {
        ticks.push(current);
        current += step;
      }
      ticks.push(current);
    }
    
    return ticks;
  };

  const tickValues = calculateRoundTicks(maxValue);
  const chartMaxValue = tickValues[tickValues.length - 1];

  return (
    <>
      <style>{`
        .bar-row {
          position: absolute;
          width: 100%;
          display: flex;
          align-items: center;
        }
        .bar-row-animated {
          transition: transform 1.8s cubic-bezier(0.165, 0.84, 0.44, 1);
        }
      `}</style>
      <div style={{ position: 'relative', height: chartHeight + 'px', overflow: 'hidden' }}>
        {data.map((artist, newIndex) => {
          const barHeight = 40;
          const gap = 3;
          const yPosition = newIndex * (barHeight + gap);
          const barWidth = (artist.value / chartMaxValue) * 90;
          const barColor = artistColors[artist.name] || colors[0];

          const oldIndex = prevData.findIndex(a => a.name === artist.name);
          const oldPosition = oldIndex >= 0 ? oldIndex * (barHeight + gap) : yPosition;
          const translateY = oldPosition - yPosition;

          let medal = '';
          let weeksText = '';
          if (newIndex === 0) {
            medal = '🥇 ';
            const weeks = goldMedalWeeks[artist.name] || 1;
            weeksText = ` (${weeks} ${weeks === 1 ? 'week' : 'weeks'})`;
          }
          else if (newIndex === 1) medal = '🥈 ';
          else if (newIndex === 2) medal = '🥉 ';

          return (
            <div
              key={artist.name}
              className="bar-row bar-row-animated"
              style={{ 
                top: yPosition + 'px', 
                height: barHeight + 'px',
                transform: `translateY(${translateY}px)`,
              }}
              onTransitionEnd={(e) => {
                if (e.propertyName === 'transform') {
                  e.currentTarget.style.transform = 'translateY(0px)';
                }
              }}
            >
              <div style={{ width: '200px', paddingRight: '16px', textAlign: 'right' }}>
                <span style={{ color: 'white', fontWeight: 'bold', fontSize: '14px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {medal}{artist.name}
                </span>
                {weeksText && (
                  <span style={{ color: '#FFD700', fontSize: '11px', fontWeight: 'bold' }}>
                    {weeksText}
                  </span>
                )}
              </div>

              <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                <svg width={barWidth + '%'} height={barHeight} style={{ transition: 'width 1.8s cubic-bezier(0.165, 0.84, 0.44, 1)', minWidth: '20px' }}>
                  <rect
                    x={0}
                    y={0}
                    width="100%"
                    height="100%"
                    fill={barColor}
                    rx={8}
                  />
                </svg>
                
                <span style={{ color: 'white', fontWeight: 'bold', fontSize: '14px', paddingLeft: '12px', whiteSpace: 'nowrap' }}>
                  {artist.value.toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}

        <div style={{ 
          position: 'absolute', 
          bottom: '0', 
          left: '200px', 
          right: '0', 
          height: '40px',
          borderTop: '2px solid rgba(255, 255, 255, 0.3)',
          display: 'flex',
          alignItems: 'flex-start',
          paddingTop: '8px'
        }}>
          {tickValues.map((tick) => {
            const position = (tick / chartMaxValue) * 90;
            
            return (
              <div
                key={tick}
                style={{
                  position: 'absolute',
                  left: `${position}%`,
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  transform: 'translateX(-50%)'
                }}
              >
                {tick.toLocaleString()}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default LastFmRaceChart;