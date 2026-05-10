// queries/part2_queries.js
// Запити до колекції tracks_by_genres для різних завдань.
// Запуск: mongosh "$env:MONGO_URI" --file queries/part2_queries.js

const DB_NAME = "spotify";
const db = db.getSiblingDB(DB_NAME);

print("\n=== ЗАВДАННЯ 1: Треки для вечірки ===");
print("\n=== Критерії: danceability > 0.7, energy > 0.7, тривалість 180000-300000 мс ===");
print("");

const partyTracks = db.tracks_by_genres.find(
  {
    "audio_features.danceability": { $gt: 0.7 },
    "audio_features.energy": { $gt: 0.7 },
    "duration_ms": { $gte: 180000, $lte: 300000 }
  },
  {
    track_name: 1,
    artists: 1,
    "audio_features.danceability": 1,
    "audio_features.energy": 1,
    "duration_ms": 1
  }
).sort({ "audio_features.danceability": -1 }).toArray();

print(`Знайдено треків: ${partyTracks.length}`);
if (partyTracks.length > 0) {
  print("Перші 5 треків:");
  partyTracks.slice(0, 5).forEach((track, index) => {
    print(`${index + 1}. ${track.track_name} - ${track.artists.join(", ")}`);
    print(`   Danceability: ${track.audio_features.danceability.toFixed(3)}, Energy: ${track.audio_features.energy.toFixed(3)}, Duration: ${(track.duration_ms / 1000).toFixed(1)}s`);
  });
}

print("\n=== ЗАВДАННЯ 2: Виконавці, у яких усі треки популярні ===");
print("Критерії: мінімум 3 треки, мінімальна популярність >= 60");
print("");

const popularArtists = db.tracks_by_genres.aggregate([
  {
    $project: {
      _id: 0,
      artists: 1,
      popularity: 1
    }
  },
  {
    $unwind: "$artists"
  },
  {
    $group: {
      _id: "$artists",
      trackCount: { $sum: 1 },
      minPopularity: { $min: "$popularity" },
      avgPopularity: { $avg: "$popularity" }
    }
  },
  {
    $match: {
      trackCount: { $gte: 3 },
      minPopularity: { $gte: 60 }
    }
  },
  {
    $sort: { avgPopularity: -1 }
  },
  {
    $limit: 20
  },
  {
    $project: {
      _id: 0,
      artist: "$_id",
      trackCount: 1,
      minPopularity: { $round: ["$minPopularity", 1] },
      avgPopularity: { $round: ["$avgPopularity", 1] }
    }
  }
]).toArray();

print(`Знайдено артистів: ${popularArtists.length}`);
popularArtists.slice(0, 10).forEach((artist, index) => {
  print(`${index + 1}. ${artist.artist}`);
  print(`   Треків: ${artist.trackCount}, Мін. популярність: ${artist.minPopularity}, Сер. популярність: ${artist.avgPopularity}`);
});

print("\n=== ЗАВДАННЯ 3: Нетипові треки (outliers за tempo) ===");
print("Критерії: tempo > середнє + 2 * stdDev по жанру");
print("");

const genreStats = db.tracks_by_genres.aggregate([
  {
    $unwind: "$track_genres"
  },
  {
    $project: {
      _id: 0,
      genre: "$track_genres",
      tempo: "$audio_features.tempo"
    }
  },
  {
    $group: {
      _id: "$genre",
      avgTempo: { $avg: "$tempo" },
      stdDevTempo: { $stdDevPop: "$tempo" }
    }
  },
  {
    $project: {
      _id: 0,
      genre: "$_id",
      avgTempo: { $round: ["$avgTempo", 0] },
      stdDevTempo: { $round: ["$stdDevTempo", 2] },
      outlierThreshold: {
        $round: [
          { $add: ["$avgTempo", { $multiply: [2, "$stdDevTempo"] }] },
          1
        ]
      }
    }
  },
  {
    $sort: { genre: 1 }
  }
], { allowDiskUse: true }).toArray();

const outlierTracks = genreStats
  .map((genreStat) => {
    const tracks = db.tracks_by_genres.find(
      {
        track_genres: genreStat.genre,
        "audio_features.tempo": { $gt: genreStat.outlierThreshold }
      },
      {
        _id: 1,
        track_name: 1,
        artists: 1,
        "audio_features.tempo": 1
      }
    ).toArray();

    return {
      genre: genreStat.genre,
      avgTempo: genreStat.avgTempo,
      outlierThreshold: genreStat.outlierThreshold,
      outlierTracks: tracks
    };
  })
  .filter((genreData) => genreData.outlierTracks.length > 0)
  .slice(0, 5);

print(`Жанрів з outlier-треками: ${outlierTracks.length}`);
outlierTracks.forEach((genreData, index) => {
  print(`${index + 1}. Жанр: ${genreData.genre}`);
  print(`   Середній tempo: ${genreData.avgTempo}, Поріг: ${genreData.outlierThreshold}`);
  print(`   Знайдено outlier-треків: ${genreData.outlierTracks.length}`);
  genreData.outlierTracks.slice(0, 2).forEach((track) => {
    print(`   - ${track.track_name} - ${track.artists.join(", ")} (tempo: ${track.audio_features.tempo.toFixed(1)})`);
  });
});

print("\n=== ЗАВДАННЯ 4: Треки для фонової роботи ===");
print("Критерії: loudness < -10, speechiness < 0.1, instrumentalness > 0.5, без explicit");
print("");

const workTracks = db.tracks_by_genres.find(
  {
    "audio_features.loudness": { $lt: -10 },
    "audio_features.speechiness": { $lt: 0.1 },
    "audio_features.instrumentalness": { $gt: 0.5 },
    "explicit": false
  },
  {
    track_name: 1,
    artists: 1,
    "audio_features.loudness": 1,
    "audio_features.speechiness": 1,
    "audio_features.instrumentalness": 1
  }
).sort({ "audio_features.instrumentalness": -1 }).toArray();

print(`Знайдено треків: ${workTracks.length}`);
if (workTracks.length > 0) {
  print("Перші 5 треків:");
  workTracks.slice(0, 5).forEach((track, index) => {
    print(`${index + 1}. ${track.track_name} - ${track.artists.join(", ")}`);
    print(`   Loudness: ${track.audio_features.loudness.toFixed(2)}, Speechiness: ${track.audio_features.speechiness.toFixed(3)}, Instrumentalness: ${track.audio_features.instrumentalness.toFixed(4)}`);
  });
}

print("\n=== ЗАВЕРШЕНО ===");
