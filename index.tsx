import * as React from "react"
import { render } from "react-dom"
import { observer } from "mobx-react"
import Map from "pigeon-maps"
import Marker from "pigeon-marker"
import Overlay from "pigeon-overlay"
import { observable, computed } from "mobx"
import { MyStorage } from "./Storage"
import geolib, { PositionAsDecimal, PositionAsSexadecimal } from "geolib"
import { groupBy } from "./util"
import {
	BarChart,
	CartesianGrid,
	XAxis,
	YAxis,
	Tooltip,
	Legend,
	Bar
} from "recharts"
import * as d from "date-fns"

type Location = {
	timestampMs: "1542619091572"
	latitudeE7: 514156517
	longitudeE7: 54468159
	accuracy: 17
	altitude: 61
	verticalAccuracy: 2
	activity: [
		{
			timestampMs: "1542619030847"
			activity: [{ type: "ON_BICYCLE"; confidence: 100 }]
		}
	]
}
type LocationHistory = {
	locations: Location[]
}

const cache = new MyStorage("cache")

function locationToLib({
	latitudeE7,
	longitudeE7
}: Location): PositionAsDecimal {
	return { latitude: latitudeE7 / 1e7, longitude: longitudeE7 / 1e7 }
}
type LatLng = [number, number]
function toLatLng(l: PositionAsDecimal | PositionAsSexadecimal): LatLng {
	return [+l.latitude, +l.longitude]
}
function fromLatLng([latitude, longitude]: LatLng): PositionAsDecimal {
	return { latitude, longitude }
}

function getDay(timestampMs: number) {
	const d = new Date(timestampMs)
	return d.toISOString().substring(0, 10)
}

function toDayTime(date: Date) {
	const zero = new Date(date)
	zero.setUTCHours(0)
	zero.setUTCMinutes(0)
	zero.setUTCSeconds(0)
	zero.setUTCMilliseconds(0)
	return date.getTime() - zero.getTime()
}
window._d = d

function formatDuration(time_ms: number) {
	const aminutes = Math.round(time_ms / 1000 / 60)
	const hours = Math.floor(aminutes / 60)
	const minutes = aminutes % 60
	return `${hours} h, ${minutes} min`
}
@observer
class UI extends React.Component {
	constructor(p: any) {
		super(p)
		this.loadCached()
	}
	async loadCached() {
		try {
			const x = await cache.get<LocationHistory>("hist")
			this.setHistory(x)
		} catch (e) {
			console.error("could not load cached", e)
		}
	}

	async setHistory(history: LocationHistory) {
		this.history = history

		const locations = this.history.locations
		const center = geolib.getCenter(
			locations.slice(0, 100).map(locationToLib)
		)
		this.workplace = toLatLng(center)
	}
	handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.currentTarget.files
		if (!files || !files.length) return
		const f = files[0]
		const url = URL.createObjectURL(f)
		const res = await fetch(url)
		const json = await res.json()
		console.log(json)
		this.setHistory(json)
		cache.set("hist", json)
	}

	@observable.ref history: LocationHistory | null = null

	@observable workplace: LatLng = [0, 0]

	@observable maxDistanceToWork_m = 200

	@computed
	get workingTimes() {
		const workplace = fromLatLng(this.workplace)
		if (!this.history) return null
		const byDay = groupBy(this.history.locations, loc =>
			getDay(+loc.timestampMs)
		)
		// HACK
		byDay.delete("2018-09-29")
		const atWorkplace = (location: Location) =>
			geolib.getDistance(workplace, locationToLib(location)) <
			this.maxDistanceToWork_m

		console.log(byDay)
		// return byDay

		const firstLastByDay: {
			day: string
			fromTo: [number, number]
			list: Location[]
			first: Location
			last: Location
		}[] = []
		for (const [day, _list] of byDay) {
			const list = _list.filter(atWorkplace)
			const first = list[list.length - 1]
			const last = list[0]
			firstLastByDay.push({
				day,
				fromTo: [
					first ? toDayTime(new Date(+first.timestampMs)) : NaN,
					first ? toDayTime(new Date(+last.timestampMs)) : NaN
				],
				list,
				first,
				last
			})
		}
		firstLastByDay.sort((a, b) => a.day.localeCompare(b.day))
		// trimLeft
		while (firstLastByDay.length > 0 && !firstLastByDay[0].first)
			firstLastByDay.shift()
		// trimRight
		while (
			firstLastByDay.length > 0 &&
			!firstLastByDay[firstLastByDay.length - 1].first
		)
			firstLastByDay.pop()
		return firstLastByDay
	}

	averageWorkingTime_ms(breakTime_ms = 1000 * 60 * 50) {
		const times = this.workingTimes
		if (!times) return NaN
		const durations = times
			.filter(x => x.first)
			.map(({ fromTo: [a, b] }) => b - a - breakTime_ms)
		const durationAvg =
			durations.reduce((a, b) => a + b, 0) / durations.length
		return durationAvg
	}

	setWorkplace = (data: {
		event: MouseEvent
		latLng: LatLng
		pixel: any
	}) => {
		console.log(data.latLng)
		this.workplace = data.latLng
	}

	render() {
		if (!this.history) {
			return (
				<div>
					<label>
						Select your google location history json file here:{" "}
						<input type="file" onChange={this.handleFile} />
					</label>
				</div>
			)
		} else {
			const workingTimes = this.workingTimes!
			const formatTime = function(e: Date) {
				return d.format(e, "HH:mm")
			}
			return (
				<div>
					<Map
						center={this.workplace}
						zoom={14}
						width={500}
						height={300}
						onClick={this.setWorkplace}
					>
						<Marker
							anchor={this.workplace}
							payload={1}
							onClick={({ event, anchor, payload }) => {}}
						/>

						{/* <Overlay anchor={[50.879, 4.6997]} offset={[120, 79]}>
							<img
								src="pigeon.jpg"
								width={240}
								height={158}
								alt=""
							/>
			</Overlay>*/}
					</Map>
					<h2>Time on location per day</h2>
					<BarChart width={900} height={500} data={workingTimes}>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis dataKey="day" />
						<YAxis
							scale="time"
							type="number"
							tickFormatter={formatTime}
							domain={["auto", "auto"]}
						/>
						<Tooltip
							formatter={([from, to], name, props) =>
								`${formatTime(from)} - ${formatTime(to)}`
							}
						/>
						<Legend />
						<Bar
							dataKey={e => e.fromTo}
							fill="#8884d8"
							name="working time"
						/>
					</BarChart>
					<p>
						Average time on location per day:{" "}
						{formatDuration(this.averageWorkingTime_ms(0))}
					</p>
					<p>
						Average time excluding break:{" "}
						{formatDuration(this.averageWorkingTime_ms())}
					</p>
					<div>
						<button onClick={e => (this.history = null)}>
							Unload
						</button>
					</div>
				</div>
			)
		}
	}
}

render(
	<div>
		<h1>How long was I at this location per day?</h1>
		<UI />
	</div>,
	document.getElementById("app")
)
