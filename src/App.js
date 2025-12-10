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
  const [activeTab, setActiveTab] = useState('artists'); // 'artists', 'albums', or 'tracks'
  const [allAlbumsData, setAllAlbumsData] = useState([]);
  const [allTracksData, setAllTracksData] = useState([]);

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

      const DICT_ARTISTS = {};
      const DICT_ALBUMS = {};
      const DICT_TRACKS = {};
      const dateRanges = [];
      
      let currentTime = joinTimestamp;
      let weekNumber = 0;

      setProgress('Fetching weekly data...');

      let consecutiveErrors = 0;
      const maxConsecutiveErrors = 5;

      while (currentTime <= endTimestamp) {
        weekNumber++;
        
        try {
          // Fetch artists, albums, and tracks for this week
          const [artistsResponse, albumsResponse, tracksResponse] = await Promise.all([
            fetch(`/api/lastfm?method=user.getweeklyartistchart&user=${username}&from=${currentTime}&to=${currentTime + secondsInWeek}`),
            fetch(`/api/lastfm?method=user.getweeklyalbumchart&user=${username}&from=${currentTime}&to=${currentTime + secondsInWeek}`),
            fetch(`/api/lastfm?method=user.getweeklytrackchart&user=${username}&from=${currentTime}&to=${currentTime + secondsInWeek}`)
          ]);

          const [artistsData, albumsData, tracksData] = await Promise.all([
            artistsResponse.json(),
            albumsResponse.json(),
            tracksResponse.json()
          ]);

          if (artistsData.error || albumsData.error || tracksData.error) {
            console.warn('API Error at week', weekNumber);
            consecutiveErrors++;
            
            const datetime = new Date(currentTime * 1000);
            dateRanges.push(datetime.toISOString().split('T')[0]);
            
            for (const artist in DICT_ARTISTS) {
              while (DICT_ARTISTS[artist].length <= weekNumber) {
                DICT_ARTISTS[artist].push(0);
              }
            }
            for (const album in DICT_ALBUMS) {
              while (DICT_ALBUMS[album].length <= weekNumber) {
                DICT_ALBUMS[album].push(0);
              }
            }
            for (const track in DICT_TRACKS) {
              while (DICT_TRACKS[track].length <= weekNumber) {
                DICT_TRACKS[track].push(0);
              }
            }
            
            currentTime += secondsInWeek;
            
            if (consecutiveErrors >= maxConsecutiveErrors) {
              console.error('Too many consecutive errors, stopping');
              break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));
            continue;
          }

          consecutiveErrors = 0;

          const datetime = new Date(currentTime * 1000);
          dateRanges.push(datetime.toISOString().split('T')[0]);

          // Get top items for progress display — simplified (album/track names only)
          const topArtist = artistsData.weeklyartistchart?.artist?.[0]?.name || 'N/A';
          const topAlbumName = albumsData.weeklyalbumchart?.album?.[0]?.name || 'N/A';
          const topTrackName = tracksData.weeklytrackchart?.track?.[0]?.name || 'N/A';

          // FIX: show on separate lines, and show only album/track names (omit artist)
          setProgress(`Fetching week ${weekNumber}... (${dateRanges[dateRanges.length - 1]})
Top Artist: ${topArtist}
Top Album: ${topAlbumName}
Top Track: ${topTrackName}`);

          // Process artists
          if (artistsData.weeklyartistchart && artistsData.weeklyartistchart.artist) {
            for (const artistDict of artistsData.weeklyartistchart.artist) {
              const currName = artistDict.name;

              if (!DICT_ARTISTS[currName]) {
                DICT_ARTISTS[currName] = new Array(weekNumber).fill(0);
              }

              DICT_ARTISTS[currName].push(parseInt(artistDict.playcount));
            }
          }

          // Process albums (KEEP internal key as "Artist - Album" but safely extract artist)
          if (albumsData.weeklyalbumchart && albumsData.weeklyalbumchart.album) {
            for (const albumDict of albumsData.weeklyalbumchart.album) {
              const artistName =
                typeof albumDict.artist === 'string'
                  ? albumDict.artist
                  : albumDict.artist?.['#text'] || '';

              const albumKey = `${artistName} - ${albumDict.name}`;

              if (!DICT_ALBUMS[albumKey]) {
                DICT_ALBUMS[albumKey] = new Array(weekNumber).fill(0);
              }

              DICT_ALBUMS[albumKey].push(parseInt(albumDict.playcount));
            }
          }

          // Process tracks (KEEP internal key as "Artist - Track" but safely extract artist)
          if (tracksData.weeklytrackchart && tracksData.weeklytrackchart.track) {
            for (const trackDict of tracksData.weeklytrackchart.track) {
              const artistName =
                typeof trackDict.artist === 'string'
                  ? trackDict.artist
                  : trackDict.artist?.['#text'] || '';

              const trackKey = `${artistName} - ${trackDict.name}`;

              if (!DICT_TRACKS[trackKey]) {
                DICT_TRACKS[trackKey] = new Array(weekNumber).fill(0);
              }

              DICT_TRACKS[trackKey].push(parseInt(trackDict.playcount));
            }
          }

          for (const artist in DICT_ARTISTS) {
            while (DICT_ARTISTS[artist].length <= weekNumber) {
              DICT_ARTISTS[artist].push(0);
            }
          }
          for (const album in DICT_ALBUMS) {
            while (DICT_ALBUMS[album].length <= weekNumber) {
              DICT_ALBUMS[album].push(0);
            }
          }
          for (const track in DICT_TRACKS) {
            while (DICT_TRACKS[track].length <= weekNumber) {
              DICT_TRACKS[track].push(0);
            }
          }

          currentTime += secondsInWeek;
          
          if (weekNumber % 50 === 0) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        } catch (err) {
          console.error('Error fetching week', weekNumber, ':', err);
          consecutiveErrors++;
          
          const datetime = new Date(currentTime * 1000);
          dateRanges.push(datetime.toISOString().split('T')[0]);
          
          for (const artist in DICT_ARTISTS) {
            while (DICT_ARTISTS[artist].length <= weekNumber) {
              DICT_ARTISTS[artist].push(0);
            }
          }
          for (const album in DICT_ALBUMS) {
            while (DICT_ALBUMS[album].length <= weekNumber) {
              DICT_ALBUMS[album].push(0);
            }
          }
          for (const track in DICT_TRACKS) {
            while (DICT_TRACKS[track].length <= weekNumber) {
              DICT_TRACKS[track].push(0);
            }
          }
          
          currentTime += secondsInWeek;
          
          if (consecutiveErrors >= maxConsecutiveErrors) {
            console.error('Too many consecutive errors, stopping at:', dateRanges[dateRanges.length - 1]);
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      setProgress('Processing data...');

      // Calculate cumulative sums for artists
      for (const artistName in DICT_ARTISTS) {
        for (let i = 1; i < DICT_ARTISTS[artistName].length; i++) {
          DICT_ARTISTS[artistName][i] = DICT_ARTISTS[artistName][i - 1] + DICT_ARTISTS[artistName][i];
        }
      }

      // Calculate cumulative sums for albums
      for (const albumName in DICT_ALBUMS) {
        for (let i = 1; i < DICT_ALBUMS[albumName].length; i++) {
          DICT_ALBUMS[albumName][i] = DICT_ALBUMS[albumName][i - 1] + DICT_ALBUMS[albumName][i];
        }
      }

      // Calculate cumulative sums for tracks
      for (const trackName in DICT_TRACKS) {
        for (let i = 1; i < DICT_TRACKS[trackName].length; i++) {
          DICT_TRACKS[trackName][i] = DICT_TRACKS[trackName][i - 1] + DICT_TRACKS[trackName][i];
        }
      }

      // Prepare artists data
      const weeklyArtistsData = [];
      for (let i = 0; i < dateRanges.length; i++) {
        const weekData = [];
        
        for (const artistName in DICT_ARTISTS) {
          if (DICT_ARTISTS[artistName][i] > 0) {
            weekData.push({
              name: artistName,
              value: DICT_ARTISTS[artistName][i]
            });
          }
        }
        
        weekData.sort((a, b) => b.value - a.value);
        weeklyArtistsData.push({
          date: dateRanges[i],
          artists: weekData.slice(0, 15)
        });
      }

      // Prepare albums data (internal names keep artist prefix)
      const weeklyAlbumsData = [];
      for (let i = 0; i < dateRanges.length; i++) {
        const weekData = [];
        
        for (const albumName in DICT_ALBUMS) {
          if (DICT_ALBUMS[albumName][i] > 0) {
            weekData.push({
              name: albumName, // internal: "Artist - Album"
              value: DICT_ALBUMS[albumName][i]
            });
          }
        }
        
        weekData.sort((a, b) => b.value - a.value);
        weeklyAlbumsData.push({
          date: dateRanges[i],
          artists: weekData.slice(0, 15) // still using 'artists' key for compatibility
        });
      }

      // Prepare tracks data (internal names keep artist prefix)
      const weeklyTracksData = [];
      for (let i = 0; i < dateRanges.length; i++) {
        const weekData = [];
        
        for (const trackName in DICT_TRACKS) {
          if (DICT_TRACKS[trackName][i] > 0) {
            weekData.push({
              name: trackName, // internal: "Artist - Track"
              value: DICT_TRACKS[trackName][i]
            });
          }
        }
        
        weekData.sort((a, b) => b.value - a.value);
        weeklyTracksData.push({
          date: dateRanges[i],
          artists: weekData.slice(0, 15) // still using 'artists' key for compatibility
        });
      }

      setAllWeeksData(weeklyArtistsData);
      setAllAlbumsData(weeklyAlbumsData);
      setAllTracksData(weeklyTracksData);
      
      if (weeklyArtistsData.length > 0) {
        setChartData(weeklyArtistsData[0]);
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
    const data = activeTab === 'artists' ? allWeeksData : activeTab === 'albums' ? allAlbumsData : allTracksData;
    if (data.length === 0) return;
    
    setIsPlaying(true);
    
    const interval = setInterval(() => {
      setCurrentWeek(prev => {
        const next = prev + 1;
        if (next >= data.length) {
          setIsPlaying(false);
          clearInterval(interval);
          return prev;
        }
        setChartData(data[next]);
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
    const data = activeTab === 'artists' ? allWeeksData : activeTab === 'albums' ? allAlbumsData : allTracksData;
    if (data.length === 0 || currentWeek >= data.length - 1) return;
    
    setIsPlaying(true);
    
    const interval = setInterval(() => {
      setCurrentWeek(prev => {
        const next = prev + 1;
        if (next >= data.length) {
          setIsPlaying(false);
          clearInterval(interval);
          return prev;
        }
        setChartData(data[next]);
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

  const handleTabChange = (tab) => {
    if (animationInterval) {
      clearInterval(animationInterval);
      setAnimationInterval(null);
    }
    setIsPlaying(false);
    setActiveTab(tab);
    setCurrentWeek(0);
    
    const data = tab === 'artists' ? allWeeksData : tab === 'albums' ? allAlbumsData : allTracksData;
    if (data.length > 0) {
      setChartData(data[0]);
    }
  };

  const currentData = activeTab === 'artists' ? allWeeksData : activeTab === 'albums' ? allAlbumsData : allTracksData;

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
            {progress && <p style={{ fontSize: '14px', color: '#93c5fd', marginTop: '8px', whiteSpace: 'pre-line' }}>{progress}</p>}
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
            
            {/* TABS */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '2px solid rgba(255,255,255,0.2)', paddingBottom: '8px' }}>
              <button
                onClick={() => handleTabChange('artists')}
                style={{
                  padding: '12px 24px',
                  background: activeTab === 'artists' ? '#3b82f6' : 'transparent',
                  color: 'white',
                  fontWeight: 'bold',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  transition: 'all 0.3s'
                }}
              >
                🎤 Artists
              </button>
              <button
                onClick={() => handleTabChange('albums')}
                style={{
                  padding: '12px 24px',
                  background: activeTab === 'albums' ? '#3b82f6' : 'transparent',
                  color: 'white',
                  fontWeight: 'bold',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  transition: 'all 0.3s'
                }}
              >
                💿 Albums
              </button>
              <button
                onClick={() => handleTabChange('tracks')}
                style={{
                  padding: '12px 24px',
                  background: activeTab === 'tracks' ? '#3b82f6' : 'transparent',
                  color: 'white',
                  fontWeight: 'bold',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  transition: 'all 0.3s'
                }}
              >
                🎵 Tracks
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ color: 'white' }}>
                <h2 style={{ fontSize: '30px', fontWeight: 'bold' }}>{chartData.date}</h2>
                <p style={{ color: '#bfdbfe', fontSize: '18px' }}>Week {currentWeek + 1} of {currentData.length}</p>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                {!isPlaying && currentWeek === 0 && (
                  <button
                    onClick={() => {
                      setCurrentWeek(0);
                      setChartData(currentData[0]);
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
                {!isPlaying && currentWeek > 0 && currentWeek < currentData.length - 1 && (
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
                      setChartData(currentData[0]);
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
                max={currentData.length - 1}
                value={currentWeek}
                onChange={(e) => {
                  if (animationInterval) {
                    clearInterval(animationInterval);
                    setAnimationInterval(null);
                  }
                  setIsPlaying(false);
                  const week = parseInt(e.target.value);
                  setCurrentWeek(week);
                  setChartData(currentData[week]);
                }}
                style={{
                  width: '100%',
                  height: '10px',
                  borderRadius: '5px',
                  outline: 'none',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                  appearance: 'none',
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((currentWeek / Math.max(1, currentData.length - 1)) * 100)}%, rgba(255,255,255,0.2) ${((currentWeek / Math.max(1, currentData.length - 1)) * 100)}%, rgba(255,255,255,0.2) 100%)`
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', color: '#bfdbfe', fontSize: '13px' }}>
                <span>Start: {currentData[0]?.date}</span>
                <span>End: {currentData[currentData.length - 1]?.date}</span>
              </div>
            </div>

            <div style={{ background: 'rgba(17, 24, 39, 0.5)', borderRadius: '12px', padding: '16px' }}>
              <AnimatedBarChart
                data={chartData.artists}
                colors={colors}
                weekIndex={currentWeek}
                allWeeksData={currentData}
                displayMode={activeTab} // <-- new prop to select display behavior
                key={currentWeek === 0 ? `reset-${Date.now()}` : 'chart'}
              />
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

const AnimatedBarChart = ({ data, colors, weekIndex, allWeeksData, displayMode = 'artists' }) => {
  const [prevData, setPrevData] = React.useState(data);
  const [artistColors, setArtistColors] = React.useState({});
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const chartHeight = 700;

  const goldMedalWeeks = React.useMemo(() => {
    const weeks = {};
    if (data.length > 0 && allWeeksData && weekIndex >= 0) {
      const currentGoldArtist = data[0].name;
      let consecutiveWeeks = 0;
      
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

  // Helper: derive display label based on displayMode
  const getDisplayLabel = (internalName) => {
    if (displayMode === 'artists') {
      return internalName; // show full artist name
    }
    // albums/tracks: internal names are "Artist - Name"
    if (typeof internalName === 'string' && internalName.includes(' - ')) {
      // return the part after the first ' - ' (album or track name)
      return internalName.split(' - ').slice(1).join(' - ').trim();
    }
    return internalName;
  };

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

          const displayLabel = getDisplayLabel(artist.name);

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
                  {medal}{displayLabel}
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
