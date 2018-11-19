export function groupBy<T, KT>(data: T[], key: (t: T) => KT) {
	const map = new Map<KT, T[]>()
	for (const ele of data) {
		const k = key(ele)
		let arr = map.get(k)
		if (!arr) {
			arr = []
			map.set(k, arr)
		}
		arr.push(ele)
	}
	return map
}
