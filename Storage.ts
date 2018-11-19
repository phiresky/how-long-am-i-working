export class MyStorage {
	ready: Promise<IDBDatabase>
	db: IDBDatabase | null = null
	constructor(name: string) {
		this.ready = new Promise((resolve, reject) => {
			var request = window.indexedDB.open(location.origin)

			request.onupgradeneeded = e => {
				this.db = request.result
				this.db.createObjectStore("store")
			}

			request.onsuccess = e => {
				this.db = request.result
				resolve(this.db)
			}

			request.onerror = e => {
				this.db = request.result
				reject(e)
			}
		})
	}

	async get<T = unknown>(key: string) {
		var store = await this.getStore()
		const request = store.get(key)
		return new Promise<T>((resolve, reject) => {
			request.onsuccess = e => resolve(request.result)
			request.onerror = reject
		})
	}
	async getStore() {
		const db = await this.ready
		return db.transaction(["store"], "readwrite").objectStore("store")
	}

	async set(key: string, value: any) {
		var store = await this.getStore()
		const request = store.put(value, key)
		return new Promise((resolve, reject) => {
			request.onsuccess = e => resolve(request.result)
			request.onerror = reject
		})
	}

	delete(key, value) {
		window.indexedDB.deleteDatabase(location.origin)
	}
}
