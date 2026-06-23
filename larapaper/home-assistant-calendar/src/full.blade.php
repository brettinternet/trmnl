@php
    use Carbon\Carbon;

    $tz = 'America/Chicago';
    $rawEvents = Arr::get($data, 'data', []);

    $today = Carbon::now($tz)->startOfDay();

    // Pretty Calendar is really a 2-week rolling view, not a full month.
    // Start on Sunday of this week, show 14 days.
    $calendarStart = $today->copy()->startOfWeek(Carbon::SUNDAY);
    $calendarDays = 14;

    $dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    $monthNamesShort = [
        1 => 'Jan', 2 => 'Feb', 3 => 'Mar', 4 => 'Apr',
        5 => 'May', 6 => 'Jun', 7 => 'Jul', 8 => 'Aug',
        9 => 'Sep', 10 => 'Oct', 11 => 'Nov', 12 => 'Dec'
    ];

    $events = collect($rawEvents)->map(function ($event) use ($tz) {
        $startRaw = data_get($event, 'start.dateTime') ?? data_get($event, 'start.date');
        $endRaw = data_get($event, 'end.dateTime') ?? data_get($event, 'end.date');

        if (!$startRaw || !$endRaw) {
            return null;
        }

        $hasDateOnly = data_get($event, 'start.date') && !data_get($event, 'start.dateTime');

        $start = $hasDateOnly
            ? Carbon::parse(data_get($event, 'start.date'), $tz)->startOfDay()
            : Carbon::parse(data_get($event, 'start.dateTime'), 'UTC')->tz($tz);

        $end = $hasDateOnly
            ? Carbon::parse(data_get($event, 'end.date'), $tz)->startOfDay()
            : Carbon::parse(data_get($event, 'end.dateTime'), 'UTC')->tz($tz);

        // Treat date-only or midnight-span items as all-day
        $midnightSpan = $start->format('H:i') === '00:00' && $end->format('H:i') === '00:00' && $end->gt($start);
        $allDay = $hasDateOnly || $midnightSpan;

        return [
            'summary' => $event['summary'] ?? 'Untitled',
            'description' => $event['description'] ?? '',
            'location' => $event['location'] ?? '',
            'all_day' => $allDay,
            'start_full' => $start,
            'end_full' => $end,
            'date_time' => $start,
            'start' => $start->format('H:i'),
            'end' => $end->format('H:i'),
        ];
    })->filter()->sortBy('start_full')->values();

    $eventOccursOnDate = function ($event, $date) {
        $dateStr = $date->format('Y-m-d');

        if ($event['all_day']) {
            return $dateStr >= $event['start_full']->format('Y-m-d')
                && $dateStr < $event['end_full']->format('Y-m-d');
        }

        return $event['date_time']->format('Y-m-d') === $dateStr;
    };

    $days = collect();
    for ($i = 0; $i < $calendarDays; $i++) {
        $date = $calendarStart->copy()->addDays($i);

        $eventCount = $events->filter(function ($event) use ($eventOccursOnDate, $date) {
            return $eventOccursOnDate($event, $date);
        })->count();

        $days->push([
            'date' => $date->copy(),
            'day_num' => $date->format('j'),
            'day_short' => $date->format('D'),
            'month_name' => $date->format('F'),
            'month_short' => $date->format('M'),
            'event_count' => min($eventCount, 4),
            'is_today' => $date->isSameDay($today),
            'is_past' => $date->lt($today),
        ]);
    }

    $upcomingDays = $days
        ->filter(function ($day) use ($today, $events, $eventOccursOnDate) {
            return $day['date']->gte($today)
                && $events->contains(function ($event) use ($eventOccursOnDate, $day) {
                    return $eventOccursOnDate($event, $day['date']);
                });
        })
        ->take(3)
        ->values();

    $formatTime = function ($time24) {
        try {
            return Carbon::createFromFormat('H:i', $time24)->format('g:i A');
        } catch (\Throwable $e) {
            return $time24;
        }
    };
@endphp

@props(['size' => 'full'])
<x-trmnl::view size="{{ $size }}">
    <x-trmnl::layout class="layout--col layout--top p--2 gap--none">

        <div class="flex flex--row w--full value--small lg:value flex--left flex--center-y p--1 mb--3">
            <div>{{ $today->format('F') }}</div>
            <div class="text--gray-40" style="margin-left: 8px;">{{ $today->format('Y') }}</div>
        </div>

        <div class="grid grid--cols-7 gap--1 w--full mb--1">
            @foreach($dayNamesShort as $dayLabel)
                <div class="col--span-1 text--center text--gray-30 flex flex--row flex--center-x lg:value--xxsmall">
                    {{ $dayLabel }}
                </div>
            @endforeach
        </div>

        <div class="grid grid--cols-7 gap--2 w--full border--h-6 pb--4">
            @foreach($days as $day)
                <div class="col--span-1 flex flex--col">
                    <div class="rounded--full text--center aspect--1/1 h--14 lg:h--22 @if($day['is_today']) bg--black text--white @elseif($day['is_past']) text--gray-40 @endif">
                        <div class="value--small lg:value lg:pt--4 pt--3 pb--0.5">{{ $day['day_num'] }}</div>

                        @if($day['event_count'] > 0)
                            <div class="flex flex--row flex--center-x gap--xsmall">
                                @for($i = 0; $i < $day['event_count']; $i++)
                                    <div class="w--1 h--1 rounded--full @if($day['is_today']) bg--white @else bg--gray-30 @endif"></div>
                                @endfor
                            </div>
                        @endif
                    </div>
                </div>
            @endforeach
        </div>

        @if($upcomingDays->isNotEmpty())
            <div class="grid grid--cols-3 gap--large w--full pt--3 p--1">
                @foreach($upcomingDays as $day)
                    @php
                        $dayEvents = $events->filter(function ($event) use ($eventOccursOnDate, $day) {
                            return $eventOccursOnDate($event, $day['date']);
                        })->values();
                    @endphp

                    <div class="col--span-1 flex flex--col gap--none">
                        <div class="flex flex--row w--full value--xsmall lg:value--small flex--left flex--center-y mb--2">
                            {{ $day['day_short'] }} {{ $day['day_num'] }} {{ $day['month_short'] }}
                        </div>

                        @foreach($dayEvents as $event)
                            @if($event['all_day'])
                                @php
                                    $totalDays = $event['end_full']->diffInDays($event['start_full']);
                                @endphp

                                <div class="flex flex--between flex--row py--1 px--2 w--full bg--gray-75 rounded--xsmall text-stroke mb--1 lg:value--xsmall">
                                    <span>{{ $event['summary'] }}</span>

                                    @if($totalDays > 1)
                                        <span class="label--small">
                                            {{ $event['start_full']->format('j M') }} - {{ $event['end_full']->copy()->subDay()->format('j M') }}
                                        </span>
                                    @endif
                                </div>
                            @else
                                <div class="px--1 py--2 border--h-6 agenda-item value--xxsmall lg:value--xsmall rounded--xsmall w--full mb--1">
                                    <div class="text--gray-30 label--small">
                                        {{ $formatTime($event['start']) }} &mdash; {{ $formatTime($event['end']) }}
                                    </div>
                                    {{ $event['summary'] }}

                                    @if(!empty($event['description']))
                                        <div class="label--small text--gray-30">{{ $event['description'] }}</div>
                                    @elseif(!empty($event['location']))
                                        <div class="label--small text--gray-30">{{ Str::limit(str_replace(["\r", "\n"], ' ', $event['location']), 44) }}</div>
                                    @endif
                                </div>
                            @endif
                        @endforeach
                    </div>
                @endforeach
            </div>
        @else
            <div class="w--full h--full flex flex--col flex--center-y flex--center-x text--center py--8">
                <span class="value--xxsmall">No upcoming appointments</span>
            </div>
        @endif

    </x-trmnl::layout>
</x-trmnl::view>
