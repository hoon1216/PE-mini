import type {
  AgeGroup,
  DashboardStats,
  DemographicStats,
  Gender,
  RankingSectionStats,
  ScoreItemStats,
  ScoreSectionStats,
} from "@/lib/types";
import { AGE_GROUP_LABELS, GENDER_LABELS } from "@/lib/types";
import { demographicKey } from "@/lib/demographic-utils";

const thClass =
  "border border-slate-300 bg-slate-100 px-2 py-2 text-center text-xs font-semibold";
const tdClass = "border border-slate-300 px-2 py-2 text-center text-xs";

function formatNum(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return String(value);
}

function getCategoryRowSpans(items: ScoreItemStats[]): (number | null)[] {
  const spans: (number | null)[] = new Array(items.length).fill(null);
  let index = 0;

  while (index < items.length) {
    const category = items[index].category;
    let span = 1;

    while (
      index + span < items.length &&
      items[index + span].category === category
    ) {
      span += 1;
    }

    spans[index] = span;
    index += span;
  }

  return spans;
}

export function DemographicTable({ data }: { data: DemographicStats }) {
  const ageGroups = data.ageGroups;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse border border-slate-300 text-sm">
        <thead>
          <tr>
            <th colSpan={2 + ageGroups.length} className={thClass}>
              조사 대상
            </th>
          </tr>
          <tr>
            <th rowSpan={2} className={thClass}>
              총 인원
            </th>
            <th colSpan={2} className={thClass}>
              성별
            </th>
            {ageGroups.length > 0 && (
              <th colSpan={ageGroups.length} className={thClass}>
                연령대
              </th>
            )}
          </tr>
          <tr>
            <th className={thClass}>남</th>
            <th className={thClass}>여</th>
            {ageGroups.map((age) => (
              <th key={age} className={thClass}>
                {AGE_GROUP_LABELS[age]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={tdClass}>{data.total}</td>
            <td className={tdClass}>{data.male}</td>
            <td className={tdClass}>{data.female}</td>
            {ageGroups.map((age) => (
              <td key={age} className={tdClass}>
                {data.byAgeGroup[age] ?? 0}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function DemographicHeaders({ ageGroups }: { ageGroups: AgeGroup[] }) {
  return (
    <>
      {ageGroups.map((age) => (
        <th key={age} colSpan={4} className={thClass}>
          {AGE_GROUP_LABELS[age]}
        </th>
      ))}
    </>
  );
}

function DemographicSubHeaders({ ageGroups }: { ageGroups: AgeGroup[] }) {
  const genders: Gender[] = ["male", "female"];
  return (
    <>
      {ageGroups.map((age) =>
        genders.map((gender) => (
          <th key={`${age}-${gender}`} colSpan={2} className={thClass}>
            {GENDER_LABELS[gender]}
          </th>
        ))
      )}
    </>
  );
}

function ScoreMetricSubHeaders({ ageGroups }: { ageGroups: AgeGroup[] }) {
  const genders: Gender[] = ["male", "female"];
  return (
    <>
      {ageGroups.map((age) =>
        genders.flatMap((gender) => [
          <th key={`${age}-${gender}-score`} className={thClass}>
            점수
          </th>,
          <th key={`${age}-${gender}-rank`} className={thClass}>
            순위
          </th>,
        ])
      )}
    </>
  );
}

export function ScoreSectionTable({
  section,
  tableLabel,
}: {
  section: ScoreSectionStats;
  tableLabel?: string;
}) {
  const { ageGroups } = section;
  const demoColSpan = ageGroups.length * 4;
  const categoryRowSpans = getCategoryRowSpans(section.items);
  const headerLabel = tableLabel ?? section.sectionTitle;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse border border-slate-300 text-sm">
        <thead>
          <tr>
            <th colSpan={4 + demoColSpan} className={thClass}>
              {headerLabel}
            </th>
          </tr>
          <tr>
            <th rowSpan={3} className={thClass}>
              구분
            </th>
            <th rowSpan={3} className={thClass}>
              조합
            </th>
            <th colSpan={2} className={thClass}>
              평균
            </th>
            {ageGroups.length > 0 && (
              <th colSpan={demoColSpan} className={thClass}>
                연령대
              </th>
            )}
          </tr>
          <tr>
            <th rowSpan={2} className={thClass}>
              점수
            </th>
            <th rowSpan={2} className={thClass}>
              순위
            </th>
            <DemographicHeaders ageGroups={ageGroups} />
          </tr>
          <tr>
            <DemographicSubHeaders ageGroups={ageGroups} />
          </tr>
          <tr>
            <th className={thClass} colSpan={2} />
            <th className={thClass} colSpan={2} />
            <ScoreMetricSubHeaders ageGroups={ageGroups} />
          </tr>
        </thead>
        <tbody>
          {section.items.map((item, index) => (
            <tr key={item.itemId}>
              {categoryRowSpans[index] !== null && (
                <td
                  rowSpan={categoryRowSpans[index]!}
                  className={`${tdClass} align-middle font-medium`}
                >
                  {item.category}
                </td>
              )}
              <td className={tdClass}>{item.combination}</td>
              <td className={tdClass}>{formatNum(item.averageScore)}</td>
              <td className={tdClass}>{formatNum(item.averageRank)}</td>
              {ageGroups.map((age) =>
                (["male", "female"] as Gender[]).flatMap((gender) => {
                  const cell = item.byDemographic[demographicKey(age, gender)];
                  return [
                    <td key={`${item.itemId}-${age}-${gender}-s`} className={tdClass}>
                      {formatNum(cell?.score)}
                    </td>,
                    <td key={`${item.itemId}-${age}-${gender}-r`} className={tdClass}>
                      {formatNum(cell?.rank)}
                    </td>,
                  ];
                })
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RankingSectionTable({
  section,
  tableLabel,
}: {
  section: RankingSectionStats;
  tableLabel?: string;
}) {
  const { ageGroups } = section;
  const criteriaColSpan = ageGroups.length * 4;
  const headerLabel = tableLabel ?? section.sectionTitle;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse border border-slate-300 text-sm">
        <thead>
          <tr>
            <th colSpan={7 + criteriaColSpan} className={thClass}>
              {headerLabel}
            </th>
          </tr>
          <tr>
            <th rowSpan={3} className={thClass}>
              조합
            </th>
            <th colSpan={2} className={thClass}>
              1순위
            </th>
            <th colSpan={2} className={thClass}>
              1+2순위
            </th>
            <th colSpan={2} className={thClass}>
              1+2+3순위
            </th>
            {ageGroups.length > 0 && (
              <th colSpan={criteriaColSpan} className={thClass}>
                1순위 선택 기준
              </th>
            )}
          </tr>
          <tr>
            <th className={thClass}>선택</th>
            <th className={thClass}>%</th>
            <th className={thClass}>선택</th>
            <th className={thClass}>%</th>
            <th className={thClass}>선택</th>
            <th className={thClass}>%</th>
            <DemographicHeaders ageGroups={ageGroups} />
          </tr>
          <tr>
            <th className={thClass} colSpan={6} />
            <DemographicSubHeaders ageGroups={ageGroups} />
          </tr>
          <tr>
            <th className={thClass} />
            <th className={thClass} colSpan={6} />
            {ageGroups.flatMap((age) =>
              (["male", "female"] as Gender[]).flatMap((gender) => [
                <th key={`${age}-${gender}-sel`} className={thClass}>
                  선택
                </th>,
                <th key={`${age}-${gender}-pct`} className={thClass}>
                  %
                </th>,
              ])
            )}
          </tr>
        </thead>
        <tbody>
          {section.combinations.map((row) => (
            <tr key={row.combination}>
              <td className={tdClass}>{row.combination}</td>
              <td className={tdClass}>{row.rank1Count}</td>
              <td className={tdClass}>{row.rank1Percent}</td>
              <td className={tdClass}>{row.rank12Count}</td>
              <td className={tdClass}>{row.rank12Percent}</td>
              <td className={tdClass}>{row.rank123Count}</td>
              <td className={tdClass}>{row.rank123Percent}</td>
              {ageGroups.flatMap((age) =>
                (["male", "female"] as Gender[]).flatMap((gender) => {
                  const cell =
                    row.byDemographic[demographicKey(age, gender)];
                  return [
                    <td key={`${row.combination}-${age}-${gender}-c`} className={tdClass}>
                      {cell?.count ?? 0}
                    </td>,
                    <td key={`${row.combination}-${age}-${gender}-p`} className={tdClass}>
                      {cell?.percent ?? 0}
                    </td>,
                  ];
                })
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function rankingTableLabel(questionTitle: string): string {
  return questionTitle && questionTitle !== "순위 문항"
    ? questionTitle
    : "순위 선정형";
}

export function DashboardSectionTables({ stats }: { stats: DashboardStats }) {
  const orderedGroups = [...stats.sectionGroups].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <DemographicTable data={stats.demographics} />
      </div>

      {orderedGroups.map((group) => {
        if (group.tables.length === 0) return null;

        return (
          <div
            key={group.sectionId}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <h3 className="text-lg font-semibold">{group.sectionTitle}</h3>
            <div className="mt-4 space-y-6">
              {group.tables.map((table) =>
                table.type === "score" ? (
                  <ScoreSectionTable
                    key={`${group.sectionId}-score`}
                    section={table.data}
                    tableLabel="점수 부과형"
                  />
                ) : (
                  <RankingSectionTable
                    key={table.data.questionId}
                    section={table.data}
                    tableLabel={rankingTableLabel(table.data.questionTitle)}
                  />
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
