import type {
  AgeGroup,
  DashboardStats,
  DemographicStats,
  Gender,
  RankingSectionStats,
  ScoreItemStats,
  ScoreSectionStats,
  TextSectionStats,
  ChoiceSectionStats,
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
            <th colSpan={3 + ageGroups.length} className={thClass}>
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
                연령대별 1순위 선택 비교
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

export function ChoiceSectionTable({
  section,
  tableLabel,
}: {
  section: ChoiceSectionStats;
  tableLabel?: string;
}) {
  const headerLabel = tableLabel ?? section.questionTitle;
  const hasOptions = section.groups.some((group) => group.options.length > 0);

  if (!hasOptions) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted">{headerLabel}</p>
        <p className="text-sm text-muted">선택된 답변이 없습니다.</p>
      </div>
    );
  }

  if (section.groupedByRank1) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse border border-slate-300 text-sm">
          <thead>
            <tr>
              <th colSpan={4} className={thClass}>
                {headerLabel}
              </th>
            </tr>
            <tr>
              <th className={thClass}>선택 1순위 컬러조합</th>
              <th className={thClass}>선택지</th>
              <th className={thClass}>선택 수</th>
              <th className={thClass}>1순위 별%</th>
            </tr>
          </thead>
          <tbody>
            {section.groups.flatMap((group) =>
              group.options.map((row, index) => (
                <tr key={`${group.groupName}-${row.option}`}>
                  {index === 0 && (
                    <td
                      rowSpan={group.options.length}
                      className={`${tdClass} align-middle font-medium`}
                    >
                      {group.groupName}
                    </td>
                  )}
                  <td className={`${tdClass} text-left`}>{row.option}</td>
                  <td className={tdClass}>{row.count}</td>
                  <td className={tdClass}>{row.percent}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  const options = section.groups[0]?.options ?? [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] border-collapse border border-slate-300 text-sm">
        <thead>
          <tr>
            <th colSpan={3} className={thClass}>
              {headerLabel}
            </th>
          </tr>
          <tr>
            <th className={thClass}>선택지</th>
            <th className={thClass}>선택 수</th>
            <th className={thClass}>%</th>
          </tr>
        </thead>
        <tbody>
          {options.map((row) => (
            <tr key={row.option}>
              <td className={tdClass}>{row.option}</td>
              <td className={tdClass}>{row.count}</td>
              <td className={tdClass}>{row.percent}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatSubmittedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR");
}

export function TextSectionTable({
  section,
  tableLabel,
}: {
  section: TextSectionStats;
  tableLabel?: string;
}) {
  const headerLabel = tableLabel ?? "주관식";

  return (
    <div className="space-y-5">
      <p className="text-sm font-medium text-muted">{headerLabel}</p>
      {section.groupedByRank1 && section.rankingQuestionTitle && (
        <p className="text-xs text-muted">
          {section.rankingQuestionTitle} 1순위 기준 그룹
        </p>
      )}
      {section.groups.map((group) => {
        const hasResponses = group.items.some((item) => item.responses.length > 0);
        if (!section.groupedByRank1 && group.groupName === "전체" && !hasResponses) {
          return (
            <p key={group.groupName} className="text-sm text-muted">
              제출된 주관식 답변이 없습니다.
            </p>
          );
        }

        return (
          <div key={group.groupName} className="space-y-3">
            {section.groupedByRank1 && (
              <h4 className="text-base font-semibold">{group.groupName}</h4>
            )}
            {group.items.map((item) => (
              <div key={item.questionId} className="overflow-x-auto">
                {section.groupedByRank1 && item.questionTitle && (
                  <p className="mb-2 text-sm font-medium">{item.questionTitle}</p>
                )}
                {item.responses.length === 0 ? (
                  <p className="text-sm text-muted">답변 없음</p>
                ) : section.groupedByRank1 ? (
                  <table className="w-full min-w-[360px] border-collapse border border-slate-300 text-sm">
                    <thead>
                      <tr>
                        <th className={thClass}>성별</th>
                        <th className={thClass}>연령대</th>
                        <th className={thClass}>답변</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.responses.map((response) => (
                        <tr key={`${item.questionId}-${response.responseId}`}>
                          <td className={tdClass}>
                            {response.gender
                              ? GENDER_LABELS[response.gender]
                              : "-"}
                          </td>
                          <td className={tdClass}>
                            {response.ageGroup
                              ? AGE_GROUP_LABELS[response.ageGroup]
                              : "-"}
                          </td>
                          <td className={`${tdClass} text-left`}>
                            {response.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full min-w-[640px] border-collapse border border-slate-300 text-sm">
                    <thead>
                      <tr>
                        <th className={thClass}>문항</th>
                        <th className={thClass}>참가자</th>
                        <th className={thClass}>성별</th>
                        <th className={thClass}>연령대</th>
                        <th className={thClass}>제출일</th>
                        <th className={thClass}>답변</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.responses.map((response) => (
                        <tr key={`${item.questionId}-${response.responseId}`}>
                          <td className={tdClass}>{item.questionTitle}</td>
                          <td className={tdClass}>
                            {response.participantName ?? "이름 없음"}
                          </td>
                          <td className={tdClass}>
                            {response.gender
                              ? GENDER_LABELS[response.gender]
                              : "-"}
                          </td>
                          <td className={tdClass}>
                            {response.ageGroup
                              ? AGE_GROUP_LABELS[response.ageGroup]
                              : "-"}
                          </td>
                          <td className={tdClass}>
                            {formatSubmittedAt(response.submittedAt)}
                          </td>
                          <td className={`${tdClass} text-left`}>
                            {response.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
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
                ) : table.type === "ranking" ? (
                  <RankingSectionTable
                    key={table.data.questionId}
                    section={table.data}
                    tableLabel={rankingTableLabel(table.data.questionTitle)}
                  />
                ) : table.type === "text" ? (
                  <TextSectionTable
                    key={`${group.sectionId}-text`}
                    section={table.data}
                  />
                ) : (
                  <ChoiceSectionTable
                    key={table.data.questionId}
                    section={table.data}
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
