// scripts/02_transform_full.js
// Запуск:
// mongosh "$env:MONGO_URI" --file scripts/02_transform_full.js

const DB_NAME = "spotify";
const sourceDb = db.getSiblingDB(DB_NAME);

sourceDb.tracks.drop();
sourceDb.tracks_by_genres.drop();
sourceDb.tracks_tmp_full.drop();

const transformPipeline = [
	{
		$project: {
			track_id: 1,
			track_name: 1,
			album_name: 1,
			explicit: 1,
			popularity: 1,
			duration_ms: 1,
			track_genre: 1,
			artists_raw: "$artists",
			danceability: 1,
			energy: 1,
			loudness: 1,
			speechiness: 1,
			acousticness: 1,
			instrumentalness: 1,
			liveness: 1,
			valence: 1,
			tempo: 1,
			key: 1,
			mode: 1,
			time_signature: 1,
		},
	},
	{
		$set: {
			artists: {
				$filter: {
					input: {
						$map: {
							input: { $split: ["$artists_raw", ";"] },
							as: "artist",
							in: { $trim: { input: "$$artist" } },
						},
					},
					as: "artist",
					cond: { $ne: ["$$artist", ""] },
				},
			},
			audio_features: {
				danceability: "$danceability",
				energy: "$energy",
				loudness: "$loudness",
				speechiness: "$speechiness",
				acousticness: "$acousticness",
				instrumentalness: "$instrumentalness",
				liveness: "$liveness",
				valence: "$valence",
				tempo: "$tempo",
				key: "$key",
				mode: "$mode",
				time_signature: "$time_signature",
			},
			duration_sec: {
				$round: [{ $divide: ["$duration_ms", 1000] }, 1],
			},
			popularity_tier: {
				$switch: {
					branches: [
						{
							case: { $gte: ["$popularity", 70] },
							then: "high",
						},
						{
							case: { $gte: ["$popularity", 40] },
							then: "medium",
						},
					],
					default: "low",
				},
			},
		},
	},
	{
		$unset: [
			"artists_raw",
			"danceability",
			"energy",
			"loudness",
			"speechiness",
			"acousticness",
			"instrumentalness",
			"liveness",
			"valence",
			"tempo",
			"key",
			"mode",
			"time_signature",
		],
	},
	{
		$out: "tracks_tmp_full",
	},
];

const consolidatePipeline = [
	{
		$group: {
			_id: "$track_id",
			doc: { $first: "$$ROOT" },
			genres: { $addToSet: "$track_genre" },
		},
	},
	{
		$set: {
			"doc.track_genres": "$genres",
		},
	},
	{
		$replaceRoot: { newRoot: "$doc" },
	},
	{
		$unset: "track_genre",
	},
	{
		$out: "tracks_by_genres",
	},
];

const transformResult = sourceDb.runCommand({
	aggregate: "tracks_raw",
	pipeline: transformPipeline,
	allowDiskUse: true,
	cursor: {},
});

if (transformResult.ok !== 1) {
	throw new Error(`Помилка трансформації tracks_raw -> tracks_tmp_full: ${tojson(transformResult)}`);
}

const consolidateResult = sourceDb.runCommand({
	aggregate: "tracks_tmp_full",
	pipeline: consolidatePipeline,
	allowDiskUse: true,
	cursor: {},
});

if (consolidateResult.ok !== 1) {
	throw new Error(`Помилка агрегації жанрів tracks_tmp_full -> tracks_by_genres: ${tojson(consolidateResult)}`);
}

const tracksCollection = sourceDb.getCollection("tracks_by_genres");
print(`Завантажено документів у tracks_by_genres: ${tracksCollection.countDocuments({})}`);
print("Приклад документа:");
printjson(tracksCollection.findOne());