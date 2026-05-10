// queries/part4_indexes.js
// Запуск: mongosh "$env:MONGO_URI" --file queries/part4_indexes.js

const DB_NAME = "spotify";
const spotifyDb = db.getSiblingDB(DB_NAME);
const collection = spotifyDb.tracks_by_genres;

function dropNonDefaultIndexes(coll) {
	const indexes = coll.getIndexes();
	indexes.forEach((index) => {
		if (index.name !== "_id_") {
			try {
				coll.dropIndex(index.name);
			} catch (error) {
				// Ignore missing index errors.
			}
		}
	});
}

function printExplainSummary(title, explainResult) {
	const stats = explainResult.executionStats;
	const winningPlan = explainResult.queryPlanner.winningPlan;

	function getLeafStage(plan) {
		// Walk down common plan shapes to find the deepest "work" stage (e.g. COLLSCAN / IXSCAN).
		// winningPlan can be:
		// - { stage, inputStage }
		// - { stage, inputStages: [...] }
		// - sharded plans (not expected here, but keep it safe)
		let cur = plan;
		const guard = 100;
		let i = 0;
		while (cur && i++ < guard) {
			if (cur.inputStage) {
				cur = cur.inputStage;
				continue;
			}
			if (cur.inputStages && cur.inputStages.length > 0) {
				cur = cur.inputStages[0];
				continue;
			}
			if (cur.shards) {
				const shardKeys = Object.keys(cur.shards);
				if (shardKeys.length > 0) {
					cur = cur.shards[shardKeys[0]].winningPlan || cur.shards[shardKeys[0]];
					continue;
				}
			}
			break;
		}
		return cur?.stage ?? null;
	}

	print(`\n=== ${title} ===`);
	print(`Winning plan stage: ${winningPlan.stage || "N/A"}`);
	print(`totalKeysExamined: ${stats.totalKeysExamined ?? 0}`);
	print(`totalDocsExamined: ${stats.totalDocsExamined ?? 0}`);
	print(`nReturned: ${stats.nReturned ?? 0}`);
	print(`executionTimeMillis: ${stats.executionTimeMillis ?? 0}`);
	print(`Leaf stage: ${getLeafStage(winningPlan) ?? "N/A"}`);
}

const query = {
	track_genres: "pop",
	"audio_features.danceability": { $gte: 0.7 }
};

print("\n=== ЗАВДАННЯ 4.1: Аналіз запиту та індексація ===");
print("\n[4.1.1] Аналіз без індексів");
dropNonDefaultIndexes(collection);

const explainBefore = collection
	.find(query)
	.sort({ popularity: -1 })
	.explain("executionStats");

printExplainSummary("Без індексів", explainBefore);

print("\n[4.1.2] Створення індексу");
const indexName = collection.createIndex({
	track_genres: 1,
	popularity: -1,
	"audio_features.danceability": 1
});
print(`Створено індекс: ${indexName}`);
print(`Структура: { track_genres: 1, popularity: -1, 'audio_features.danceability': 1 }`);

print("\n[4.1.3] Аналіз після індексу");
const explainAfter = collection
	.find(query)
	.sort({ popularity: -1 })
	.explain("executionStats");

printExplainSummary("Після індексу", explainAfter);

print("\n=== ПОРІВНЯННЯ ===");
print(`Документів переглянуто: ${explainBefore.executionStats.totalDocsExamined ?? 0} → ${explainAfter.executionStats.totalDocsExamined ?? 0}`);
print(`Ключів переглянуто: ${explainBefore.executionStats.totalKeysExamined ?? 0} → ${explainAfter.executionStats.totalKeysExamined ?? 0}`);
print(`Час виконання: ${explainBefore.executionStats.executionTimeMillis ?? 0} → ${explainAfter.executionStats.executionTimeMillis ?? 0} ms`);

print("\n=== ЗАВДАННЯ 4.2: Індекс для інших полів (work tracks) ===");
dropNonDefaultIndexes(collection);

const workQuery = {
	"audio_features.loudness": { $lt: -10 },
	"audio_features.speechiness": { $lt: 0.1 },
	"audio_features.instrumentalness": { $gt: 0.5 },
	explicit: false
};

print("\n[4.2.1] Аналіз без індексів");
const workExplainBefore = collection
	.find(workQuery)
	.explain("executionStats");
printExplainSummary("Work tracks без індексів", workExplainBefore);

print("\n[4.2.2] Створення індексу");
const workIndexName = collection.createIndex({
	explicit: 1,
	"audio_features.instrumentalness": 1,
	"audio_features.speechiness": 1
});
print(`Створено індекс: ${workIndexName}`);
print(`Структура: { explicit: 1, 'audio_features.instrumentalness': 1, 'audio_features.speechiness': 1 }`);

print("\n[4.2.3] Аналіз після індексу");
const workExplainAfter = collection
	.find(workQuery)
	.explain("executionStats");
printExplainSummary("Work tracks після індексу", workExplainAfter);

print("\n[4.2.4] Порівняння");
print(`Документів переглянуто: ${workExplainBefore.executionStats.totalDocsExamined ?? 0} → ${workExplainAfter.executionStats.totalDocsExamined ?? 0}`);
print(`Ключів переглянуто: ${workExplainBefore.executionStats.totalKeysExamined ?? 0} → ${workExplainAfter.executionStats.totalKeysExamined ?? 0}`);
print(`Час виконання: ${workExplainBefore.executionStats.executionTimeMillis ?? 0} → ${workExplainAfter.executionStats.executionTimeMillis ?? 0} ms`);


print("\n=== ЗАВДАННЯ 4.3: Покривний запит ===");
print("Запит:");
print("db.tracks_by_genres.find({ track_genres: 'pop', popularity: { $gte: 70 } });");

const coveredQuery = {
	track_genres: "pop",
	popularity: { $gte: 70 }
};

const coveredExplain = collection
	.find(coveredQuery)
	.explain("executionStats");

dropNonDefaultIndexes(collection);
collection.createIndex({ track_genres: 1, popularity: 1 });

const coveredExplainAfterIndex = collection
	.find(coveredQuery)
	.explain("executionStats");

print(JSON.stringify({
	covered_before: {
		totalDocsExamined: coveredExplain.executionStats.totalDocsExamined ?? 0,
		nReturned: coveredExplain.executionStats.nReturned ?? 0,
		winningPlanStage: coveredExplain.queryPlanner.winningPlan.stage ?? null,
		leafStage: (() => {
			const plan = coveredExplain.queryPlanner.winningPlan;
			let cur = plan;
			for (let i = 0; i < 100; i++) {
				if (cur?.inputStage) cur = cur.inputStage;
				else if (cur?.inputStages?.length) cur = cur.inputStages[0];
				else break;
			}
			return cur?.stage ?? null;
		})()
	},
	covered_after: {
		totalDocsExamined: coveredExplainAfterIndex.executionStats.totalDocsExamined ?? 0,
		nReturned: coveredExplainAfterIndex.executionStats.nReturned ?? 0,
		winningPlanStage: coveredExplainAfterIndex.queryPlanner.winningPlan.stage ?? null,
		leafStage: (() => {
			const plan = coveredExplainAfterIndex.queryPlanner.winningPlan;
			let cur = plan;
			for (let i = 0; i < 100; i++) {
				if (cur?.inputStage) cur = cur.inputStage;
				else if (cur?.inputStages?.length) cur = cur.inputStages[0];
				else break;
			}
			return cur?.stage ?? null;
		})()
	}
}));

print("\n=== ЗАВДАННЯ 4.3: Покривний запит з проєкцією ===");
const actualCoveredQuery = collection
	.find(
		{ track_genres: 'pop', popularity: { $gte: 70 } },
		{ _id: 0, track_genres: 1, popularity: 1 }
	)
	.explain("executionStats");

print(JSON.stringify({
	coveredWithProjection: {
		title: "Covered query with projection",
		totalDocsExamined: actualCoveredQuery.executionStats.totalDocsExamined ?? 0,
		totalKeysExamined: actualCoveredQuery.executionStats.totalKeysExamined ?? 0,
		nReturned: actualCoveredQuery.executionStats.nReturned ?? 0,
		executionTimeMillis: actualCoveredQuery.executionStats.executionTimeMillis ?? 0,
		winningPlanStage: actualCoveredQuery.queryPlanner.winningPlan.stage || null,
		leafStage: (() => {
			const plan = actualCoveredQuery.queryPlanner.winningPlan;
			let cur = plan;
			for (let i = 0; i < 100; i++) {
				if (cur?.inputStage) cur = cur.inputStage;
				else if (cur?.inputStages?.length) cur = cur.inputStages[0];
				else break;
			}
			return cur?.stage ?? null;
		})()
	}
}));

print("\n=== ЗАВЕРШЕНО ===");