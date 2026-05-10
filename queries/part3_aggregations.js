// queries/part3_aggregations.js
// Запуск: mongosh "$env:MONGO_URI" --file queries/part3_aggregations.js

const DB_NAME = "spotify";
const spotifyDb = db.getSiblingDB(DB_NAME);

print("\n=== ЗАВДАННЯ 1: Топ-10 виконавців за середньою популярністю ===");
print("Критерії: мінімум 5 треків на виконавця");
print("");

const topArtists = spotifyDb.tracks_by_genres.aggregate([
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
			trackCount: { $sum: 5 },
			avgPopularity: { $avg: "$popularity" }
		}
	},
	{
		$match: {
			trackCount: { $gte: 1 }
		}
	},
	{
		$sort: { avgPopularity: -1 }
	},
	{
		$limit: 10
	},
	{
		$project: {
			_id: 0,
			artist: "$_id",
			avgPopularity: { $round: ["$avgPopularity", 1] },
			trackCount: 1
		}
	}
], { allowDiskUse: true }).toArray();

print(`Знайдено виконавців: ${topArtists.length}`);
topArtists.forEach((artist, index) => {
	print(`${index + 1}. ${artist.artist}`);
	print(`   Середня популярність: ${artist.avgPopularity}, Треків: ${artist.trackCount}`);
});

print("\n=== ЗАВДАННЯ 2: Розподіл треків за настроєм ===");
print("Критерії: valence і energy, поріг 0.5 для високого/низького значення");
print("");

const moodDistribution = spotifyDb.tracks_by_genres.aggregate([
	{
		$project: {
			_id: 0,
			valence: "$audio_features.valence",
			energy: "$audio_features.energy"
		}
	},
	{
		$set: {
			mood: {
				$switch: {
					branches: [
						{
							case: {
								$and: [
									{ $gte: ["$valence", 0.5] },
									{ $gte: ["$energy", 0.5] }
								]
							},
							then: "happy"
						},
						{
							case: {
								$and: [
									{ $lt: ["$valence", 0.5] },
									{ $gte: ["$energy", 0.5] }
								]
							},
							then: "angry"
						},
						{
							case: {
								$and: [
									{ $gte: ["$valence", 0.5] },
									{ $lt: ["$energy", 0.5] }
								]
							},
							then: "calm"
						}
					],
					default: "sad"
				}
			}
		}
	},
	{
		$group: {
			_id: "$mood",
			trackCount: { $sum: 1 }
		}
	},
	{
		$project: {
			_id: 0,
			mood: "$_id",
			trackCount: 1
		}
	},
	{
		$sort: { mood: 1 }
	}
]).toArray();

print("Настрій | Кількість треків");
print("------------------------");
moodDistribution.forEach((row) => {
	print(`${row.mood} | ${row.trackCount}`);
});

print("\n=== ЗАВДАННЯ 3: Найбільш \"танцювальний\" жанр ===");
print("Критерії: мінімум 100 треків у жанрі");
print("");

const danceableGenres = spotifyDb.tracks_by_genres.aggregate([
	{
		$project: {
			_id: 0,
			track_genres: 1,
			"audio_features.danceability": 1,
			"audio_features.energy": 1,
			"audio_features.valence": 1
		}
	},
	{
		$unwind: "$track_genres"
	},
	{
		$group: {
			_id: "$track_genres",
			trackCount: { $sum: 1 },
			avgDanceability: { $avg: "$audio_features.danceability" },
			avgEnergy: { $avg: "$audio_features.energy" },
			avgValence: { $avg: "$audio_features.valence" }
		}
	},
	{
		$match: {
			trackCount: { $gte: 100 }
		}
	},
	{
		$sort: {
			avgDanceability: -1,
			avgEnergy: -1,
			avgValence: -1
		}
	},
	{
		$project: {
			_id: 0,
			genre: "$_id",
			avg_danceability: { $round: ["$avgDanceability", 3] },
			avg_energy: { $round: ["$avgEnergy", 3] },
			avg_valence: { $round: ["$avgValence", 3] },
			track_count: "$trackCount"
		}
	}
], { allowDiskUse: true }).toArray();

print("genre | avg_danceability | avg_energy | avg_valence | track_count");
print("---------------------------------------------------------------");
danceableGenres.forEach((genre) => {
	print(`${genre.genre} | ${genre.avg_danceability} | ${genre.avg_energy} | ${genre.avg_valence} | ${genre.track_count}`);
});

print("\n=== ЗАВЕРШЕНО ===");
