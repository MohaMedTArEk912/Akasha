import { MongoClient, ObjectId } from 'mongodb';

type Dict = Record<string, any>;

type Relation = {
	model: string;
	type: 'one' | 'many';
	localField: string;
	foreignField: string;
};

type ModelConfig = {
	collection: string;
	idField: 'id' | 'idRoot';
	relations: Record<string, Relation>;
};

type ModelDelegate = {
	findMany: (args?: Dict) => Promise<any[]>;
	findFirst: (args?: Dict) => Promise<any | null>;
	findUnique: (args?: Dict) => Promise<any | null>;
	create: (args?: Dict) => Promise<any>;
	createMany: (args?: Dict) => Promise<{ count: number }>;
	update: (args?: Dict) => Promise<any>;
	delete: (args?: Dict) => Promise<any>;
	deleteMany: (args?: Dict) => Promise<{ count: number }>;
	upsert: (args?: Dict) => Promise<any>;
};

export type PrismaLikeClient = {
	[model: string]: any;
	project: ModelDelegate;
	page: ModelDelegate;
	block: ModelDelegate;
	variable: ModelDelegate;
	dataModel: ModelDelegate;
	apiEndpoint: ModelDelegate;
	logicFlow: ModelDelegate;
	useCase: ModelDelegate;
	apiRequest: ModelDelegate;
	team: ModelDelegate;
	teamMember: ModelDelegate;
	joinRequest: ModelDelegate;
	teamChat: ModelDelegate;
	teamIdea: ModelDelegate;
	ideaPipeline: ModelDelegate;
	$transaction: <T>(arg: ((tx: PrismaLikeClient) => Promise<T> | T) | Array<Promise<T>>) => Promise<T | T[]>;
	$connect: () => Promise<void>;
	$disconnect: () => Promise<void>;
};

const MODEL_CONFIG: Record<string, ModelConfig> = {
	project: {
		collection: 'Project',
		idField: 'id',
		relations: {
			pages: { model: 'page', type: 'many', localField: 'id', foreignField: 'projectId' },
			blocks: { model: 'block', type: 'many', localField: 'id', foreignField: 'projectId' },
			variables: { model: 'variable', type: 'many', localField: 'id', foreignField: 'projectId' },
			dataModels: { model: 'dataModel', type: 'many', localField: 'id', foreignField: 'projectId' },
			apis: { model: 'apiEndpoint', type: 'many', localField: 'id', foreignField: 'projectId' },
			logicFlows: { model: 'logicFlow', type: 'many', localField: 'id', foreignField: 'projectId' },
			useCases: { model: 'useCase', type: 'many', localField: 'id', foreignField: 'projectId' },
			apiRequests: { model: 'apiRequest', type: 'many', localField: 'id', foreignField: 'projectId' },
		},
	},
	page: {
		collection: 'Page',
		idField: 'idRoot',
		relations: {
			blocks: { model: 'block', type: 'many', localField: 'idRoot', foreignField: 'pageId' },
			project: { model: 'project', type: 'one', localField: 'projectId', foreignField: 'id' },
		},
	},
	block: {
		collection: 'Block',
		idField: 'id',
		relations: {
			page: { model: 'page', type: 'one', localField: 'pageId', foreignField: 'idRoot' },
			project: { model: 'project', type: 'one', localField: 'projectId', foreignField: 'id' },
		},
	},
	variable: { collection: 'Variable', idField: 'id', relations: {} },
	dataModel: { collection: 'DataModel', idField: 'id', relations: {} },
	apiEndpoint: { collection: 'ApiEndpoint', idField: 'id', relations: {} },
	logicFlow: { collection: 'LogicFlow', idField: 'id', relations: {} },
	useCase: { collection: 'UseCase', idField: 'id', relations: {} },
	apiRequest: { collection: 'ApiRequest', idField: 'id', relations: {} },
	team: {
		collection: 'Team',
		idField: 'id',
		relations: {
			members: { model: 'teamMember', type: 'many', localField: 'id', foreignField: 'teamId' },
			joinRequests: { model: 'joinRequest', type: 'many', localField: 'id', foreignField: 'teamId' },
			chats: { model: 'teamChat', type: 'many', localField: 'id', foreignField: 'teamId' },
			ideas: { model: 'teamIdea', type: 'many', localField: 'id', foreignField: 'teamId' },
			pipelines: { model: 'ideaPipeline', type: 'many', localField: 'id', foreignField: 'teamId' },
		},
	},
	teamMember: {
		collection: 'TeamMember',
		idField: 'id',
		relations: {
			team: { model: 'team', type: 'one', localField: 'teamId', foreignField: 'id' },
		},
	},
	joinRequest: {
		collection: 'JoinRequest',
		idField: 'id',
		relations: {
			team: { model: 'team', type: 'one', localField: 'teamId', foreignField: 'id' },
		},
	},
	teamChat: { collection: 'TeamChat', idField: 'id', relations: {} },
	teamIdea: { collection: 'TeamIdea', idField: 'id', relations: {} },
	ideaPipeline: { collection: 'IdeaPipeline', idField: 'id', relations: {} },
};

function isPlainObject(value: unknown): value is Dict {
	return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date) && !(value instanceof ObjectId);
}

function isObjectIdHex(value: unknown): value is string {
	return typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
}

function idVariants(value: unknown): unknown[] {
	if (!isObjectIdHex(value)) return [value];
	return [value, new ObjectId(value)];
}

function stripUndefined(input: Dict): Dict {
	const out: Dict = {};
	for (const [key, value] of Object.entries(input)) {
		if (value !== undefined) out[key] = value;
	}
	return out;
}

function getModelConfig(model: string): ModelConfig {
	const config = MODEL_CONFIG[model];
	if (!config) throw new Error(`Unknown model: ${model}`);
	return config;
}

function mapLogicalFieldToStorage(model: string, field: string): string {
	if (field === 'id') {
		return getModelConfig(model).idField === 'id' ? '_id' : 'id';
	}
	if (field === 'idRoot') return '_id';
	return field;
}

function toLogicalDoc(model: string, doc: Dict | null): Dict | null {
	if (!doc) return null;
	const out = { ...doc };
	const id = doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id);
	delete out._id;
	if (getModelConfig(model).idField === 'idRoot') {
		out.idRoot = id;
		if (!out.id) out.id = id;
	} else {
		out.id = id;
	}
	return out;
}

function valueToStorage(field: string, value: unknown): unknown {
	if (value === null) return null;
	if (Array.isArray(value)) return value;
	if (typeof value !== 'string') return value;

	if (field === '_id' || field === 'id' || field === 'idRoot' || field.endsWith('Id')) {
		if (isObjectIdHex(value)) return new ObjectId(value);
	}
	return value;
}

function buildFieldFilter(storageField: string, value: unknown): Dict {
	if (isPlainObject(value)) {
		if ('contains' in value || 'startsWith' in value || 'endsWith' in value) {
			const needle = String(value.contains ?? value.startsWith ?? value.endsWith ?? '');
			const escaped = needle.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&');
			const prefix = 'startsWith' in value ? '^' : '';
			const suffix = 'endsWith' in value ? '$' : '';
			const flags = value.mode === 'insensitive' ? 'i' : 'i';
			return { [storageField]: { $regex: `${prefix}${escaped}${suffix}`, $options: flags } };
		}
		if ('in' in value && Array.isArray(value.in)) {
			return { [storageField]: { $in: value.in.map((item) => valueToStorage(storageField, item)) } };
		}
		if ('notIn' in value && Array.isArray(value.notIn)) {
			return { [storageField]: { $nin: value.notIn.map((item) => valueToStorage(storageField, item)) } };
		}
		if ('equals' in value) {
			return { [storageField]: valueToStorage(storageField, value.equals) };
		}

		const ops: Dict = {};
		if ('gt' in value) ops.$gt = value.gt;
		if ('gte' in value) ops.$gte = value.gte;
		if ('lt' in value) ops.$lt = value.lt;
		if ('lte' in value) ops.$lte = value.lte;
		if ('not' in value) ops.$ne = value.not;
		if (Object.keys(ops).length > 0) {
			return { [storageField]: ops };
		}

	}

	if (storageField === '_id' && isObjectIdHex(value)) {
		return { [storageField]: { $in: idVariants(value) } };
	}

	if ((storageField.endsWith('Id') || storageField === 'teamId' || storageField === 'projectId' || storageField === 'pageId' || storageField === 'parentId') && isObjectIdHex(value)) {
		return { [storageField]: { $in: idVariants(value) } };
	}

	return { [storageField]: valueToStorage(storageField, value) };
}

function mergeWithAnd(filters: Dict[]): Dict {
	const valid = filters.filter((entry) => Object.keys(entry).length > 0);
	if (valid.length === 0) return {};
	if (valid.length === 1) return valid[0]!;
	return { $and: valid };
}

function whereToFilter(model: string, where?: Dict): Dict {
	if (!where) return {};

	const filters: Dict[] = [];
	for (const [key, value] of Object.entries(where)) {
		if (key === 'AND' && Array.isArray(value)) {
			filters.push({ $and: value.map((item) => whereToFilter(model, item)) });
			continue;
		}
		if (key === 'OR' && Array.isArray(value)) {
			filters.push({ $or: value.map((item) => whereToFilter(model, item)) });
			continue;
		}
		if (key === 'NOT') {
			filters.push({ $nor: [whereToFilter(model, value as Dict)] });
			continue;
		}

		if (key.includes('_') && isPlainObject(value)) {
			const parts = Object.entries(value).map(([partKey, partValue]) => {
				const storageField = mapLogicalFieldToStorage(model, partKey);
				return buildFieldFilter(storageField, partValue);
			});
			filters.push(mergeWithAnd(parts));
			continue;
		}

		const storageField = mapLogicalFieldToStorage(model, key);
		filters.push(buildFieldFilter(storageField, value));
	}

	return mergeWithAnd(filters);
}

function orderByToSort(model: string, orderBy?: Dict): Dict {
	if (!orderBy) return { _id: 1 };
	const [key, dir] = Object.entries(orderBy)[0] || [];
	if (!key) return { _id: 1 };
	const storageField = mapLogicalFieldToStorage(model, key);
	return { [storageField]: String(dir).toLowerCase() === 'desc' ? -1 : 1 };
}

function pickSelectFields(doc: Dict, select: Dict): Dict {
	const out: Dict = {};
	for (const [field, enabled] of Object.entries(select)) {
		if (enabled === true && field in doc) out[field] = doc[field];
	}
	return out;
}

function inferDatabaseName(uri: string): string {
	const match = uri.match(/\/([^/?]+)(?:\?|$)/);
	return match?.[1] || 'akasha_prototype';
}

const mongoUri = process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/akasha_prototype';
const dbName = process.env.MONGODB_DB_NAME || inferDatabaseName(mongoUri);

const globalMongo = globalThis as unknown as {
	__akashaMongoClient?: MongoClient;
	__akashaMongoReady?: Promise<MongoClient>;
};

function getClient(): Promise<MongoClient> {
	if (globalMongo.__akashaMongoClient) {
		return Promise.resolve(globalMongo.__akashaMongoClient);
	}
	if (!globalMongo.__akashaMongoReady) {
		const client = new MongoClient(mongoUri);
		globalMongo.__akashaMongoReady = client.connect().then((connected) => {
			globalMongo.__akashaMongoClient = connected;
			return connected;
		});
	}
	return globalMongo.__akashaMongoReady;
}

function buildPrismaLikeClient(): PrismaLikeClient {
	const client = {} as PrismaLikeClient;

	const loadRelations = async (model: string, row: Dict, args: Dict): Promise<Dict> => {
		const include = args?.include;
		const select = args?.select;
		const config = getModelConfig(model);
		const result = select ? pickSelectFields(row, select) : { ...row };

		const relationRequests: Array<[string, any]> = [];

		if (isPlainObject(include)) {
			relationRequests.push(...Object.entries(include));
		}

		if (isPlainObject(select)) {
			for (const [key, value] of Object.entries(select)) {
				if (isPlainObject(value) || value === true) {
					relationRequests.push([key, value]);
				}
			}
		}

		for (const [relationName, relationArgsRaw] of relationRequests) {
			const relation = config.relations[relationName];
			if (!relation) continue;

			const relationArgs = relationArgsRaw === true ? {} : (relationArgsRaw || {});
			const localValue = row[relation.localField];

			if (localValue === undefined || localValue === null) {
				result[relationName] = relation.type === 'many' ? [] : null;
				continue;
			}

			const relationWhere = {
				...(relationArgs.where || {}),
				[relation.foreignField]: localValue,
			};

			if (relation.type === 'many') {
				result[relationName] = await client[relation.model].findMany({
					...(relationArgs.orderBy ? { orderBy: relationArgs.orderBy } : {}),
					...(relationArgs.take !== undefined ? { take: relationArgs.take } : {}),
					...(relationArgs.skip !== undefined ? { skip: relationArgs.skip } : {}),
					...(relationArgs.select ? { select: relationArgs.select } : {}),
					...(relationArgs.include ? { include: relationArgs.include } : {}),
					where: relationWhere,
				});
			} else {
				result[relationName] = await client[relation.model].findFirst({
					...(relationArgs.select ? { select: relationArgs.select } : {}),
					...(relationArgs.include ? { include: relationArgs.include } : {}),
					where: relationWhere,
				});
			}
		}

		return result;
	};

	for (const model of Object.keys(MODEL_CONFIG)) {

		client[model] = {
			findMany: async (args: Dict = {}) => {
				const modelConfig = getModelConfig(model);
				const mongo = await getClient();
				const coll = mongo.db(dbName).collection(modelConfig.collection);
				const cursor = coll.find(whereToFilter(model, args.where || {})).sort(orderByToSort(model, args.orderBy));
				if (typeof args.skip === 'number') cursor.skip(args.skip);
				if (typeof args.take === 'number') cursor.limit(args.take);
				const docs = await cursor.toArray();
				const rows = docs.map((doc) => toLogicalDoc(model, doc) as Dict);
				return Promise.all(rows.map((row) => loadRelations(model, row, args)));
			},

			findFirst: async (args: Dict = {}) => {
				const rows = await client[model].findMany({ ...args, take: 1 });
				return rows[0] ?? null;
			},

			findUnique: async (args: Dict = {}) => {
				return client[model].findFirst(args);
			},

			create: async (args: Dict = {}) => {
				const modelConfig = getModelConfig(model);
				const mongo = await getClient();
				const coll = mongo.db(dbName).collection(modelConfig.collection);
				const data = stripUndefined({ ...(args.data || {}) });

				const nestedCreates: Array<{ relation: Relation; relationName: string; payload: any }> = [];
				for (const [key, value] of Object.entries(data)) {
					const relation = modelConfig.relations[key];
					if (relation && isPlainObject(value) && 'create' in value) {
						nestedCreates.push({ relation, relationName: key, payload: value });
						delete data[key];
					}
				}

				const now = new Date();
				if (data.createdAt === undefined) data.createdAt = now;
				if (data.updatedAt === undefined) data.updatedAt = now;

				const insertDoc: Dict = {};
				for (const [key, value] of Object.entries(data)) {
					if (key === 'id' && modelConfig.idField === 'id') {
						insertDoc._id = valueToStorage('_id', value);
					} else if (key === 'idRoot') {
						insertDoc._id = valueToStorage('_id', value);
					} else {
						insertDoc[key] = valueToStorage(mapLogicalFieldToStorage(model, key), value);
					}
				}

				if (!insertDoc._id) {
					insertDoc._id = new ObjectId();
				}

				await coll.insertOne(insertDoc);
				const created = toLogicalDoc(model, insertDoc) as Dict;

				for (const nested of nestedCreates) {
					const createdPayload = Array.isArray(nested.payload.create)
						? nested.payload.create
						: [nested.payload.create];
					for (const item of createdPayload) {
						await client[nested.relation.model].create({
							data: {
								...item,
								[nested.relation.foreignField]: created[nested.relation.localField],
							},
						});
					}
				}

				if (args.select || args.include) {
					return client[model].findUnique({
						where: { [modelConfig.idField]: created[modelConfig.idField] },
						...(args.select ? { select: args.select } : {}),
						...(args.include ? { include: args.include } : {}),
					});
				}

				return created;
			},

			createMany: async (args: Dict = {}) => {
				const rows = Array.isArray(args.data) ? args.data : [];
				let count = 0;
				for (const row of rows) {
					await client[model].create({ data: row });
					count += 1;
				}
				return { count };
			},

			update: async (args: Dict = {}) => {
				const modelConfig = getModelConfig(model);
				const mongo = await getClient();
				const coll = mongo.db(dbName).collection(modelConfig.collection);
				const existing = await client[model].findFirst({ where: args.where || {} });
				if (!existing) {
					throw new Error(`No ${model} found for update`);
				}

				const data = stripUndefined({ ...(args.data || {}) });
				data.updatedAt = data.updatedAt ?? new Date();

				const setDoc: Dict = {};
				for (const [key, value] of Object.entries(data)) {
					if (key === 'id' || key === 'idRoot') continue;
					setDoc[mapLogicalFieldToStorage(model, key)] = valueToStorage(mapLogicalFieldToStorage(model, key), value);
				}

				await coll.updateOne(whereToFilter(model, { [modelConfig.idField]: existing[modelConfig.idField] }), { $set: setDoc });

				return client[model].findUnique({
					where: { [modelConfig.idField]: existing[modelConfig.idField] },
					...(args.select ? { select: args.select } : {}),
					...(args.include ? { include: args.include } : {}),
				});
			},

			delete: async (args: Dict = {}) => {
				const modelConfig = getModelConfig(model);
				const mongo = await getClient();
				const coll = mongo.db(dbName).collection(modelConfig.collection);
				const found = await coll.findOneAndDelete(whereToFilter(model, args.where || {}));
				if (!found) throw new Error(`No ${model} found for delete`);
				return toLogicalDoc(model, found as Dict);
			},

			deleteMany: async (args: Dict = {}) => {
				const modelConfig = getModelConfig(model);
				const mongo = await getClient();
				const coll = mongo.db(dbName).collection(modelConfig.collection);
				const result = await coll.deleteMany(whereToFilter(model, args.where || {}));
				return { count: result.deletedCount || 0 };
			},

			upsert: async (args: Dict = {}) => {
				const existing = await client[model].findUnique({ where: args.where || {} });
				if (existing) {
					return client[model].update({ where: args.where || {}, data: args.update || {} });
				}
				return client[model].create({ data: args.create || {} });
			},
		};
	}

	client.$transaction = async <T>(arg: ((tx: PrismaLikeClient) => Promise<T> | T) | Array<Promise<T>>) => {
		if (typeof arg === 'function') {
			return arg(client);
		}
		if (Array.isArray(arg)) {
			return Promise.all(arg);
		}
		return arg;
	};

	client.$connect = async () => {
		await getClient();
	};

	client.$disconnect = async () => {
		if (globalMongo.__akashaMongoClient) {
			await globalMongo.__akashaMongoClient.close();
			globalMongo.__akashaMongoClient = undefined;
			globalMongo.__akashaMongoReady = undefined;
		}
	};

	return client;
}

const prisma: PrismaLikeClient = buildPrismaLikeClient();

export default prisma;
