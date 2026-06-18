import type {
  AgeGroup,
  DashboardStats,
  DemographicStats,
  Gender,
  RankingSectionStats,
  ScoreSectionStats,
  ScoreCompareSectionStats,
  TextSectionStats,
  ChoiceSectionStats,
  ChoiceComparisonSectionStats,
  ComparisonSegment,
} from "@/lib/types";
import { AGE_GROUP_LABELS, GENDER_LABELS } from "@/lib/types";
import { demographicKey, scoreCustomFieldKey } from "@/lib/demographic-utils";
import {
  getCategoryRowSpans,
} from "@/lib/choice-comparison-stats";
import {
  dashboardTableKey,
  dashboardTableTitle,
  type DashboardTableEntry,
} from "@/lib/dashboard-layout";
import { ScoreCompareReasonViewer } from "@/components/admin/score-compare-reason-viewer";
import type { ScoreCompareScoreStats } from "@/lib/types";

const thClass =
  "border border-slate-300 bg-slate-100 px-2 py-2 text-center text-xs font-semibold";
const tdClass = "border border-slate-300 px-2 py-2 text-center text-xs";

function formatNum(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return String(value);
}

function groupSegmentHeaderSpans(segments: ComparisonSegment[]) {
  const groups: { label: string; count: number }[] = [];

  for (const segment of segments) {
    const last = groups[groups.length - 1];
    if (last && last.label === segment.groupLabel) {
      last.count += 1;
      continue;
    }
    groups.push({ label: segment.groupLabel, count: 1 });
  }

  return groups;
}

function ScoreCompareScoreTable({
  sectionTitle,
  scoreStats,
}: {
  sectionTitle: string;
  scoreStats: ScoreCompareScoreStats;
}) {
  const { segments, items } = scoreStats;
  const segmentGroups = groupSegmentHeaderSpans(segments);
  const categoryRowSpans = getCategoryRowSpans(
    items.map((item) => ({ category: item.category }))
  );
  const totalColSpan = 2 + segments.length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse border border-slate-300 text-sm">
        <thead>
          <tr>
            <th colSpan={totalColSpan} className={thClass}>
              {sectionTitle}
            </th>
          </tr>
          <tr>
            <th rowSpan={2} className={thClass}>
              구분
            </th>
            <th rowSpan={2} className={thClass}>
              디자인 안
            </th>
            {segmentGroups.map((group) => (
              <th
                key={group.label}
                colSpan={group.count}
                className={thClass}
              >
                {group.label}
              </th>
            ))}
          </tr>
          <tr>
            {segments.map((segment) => (
              <th key={segment.key} className={thClass}>
                {segment.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
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
              {segments.map((segment) => (
                <td key={`${item.itemId}-${segment.key}`} className={tdClass}>
                  {formatNum(item.bySegment[segment.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DemographicTable({ data }: { data: DemographicStats }) {
  const ageGroups = data.ageGroups;

  return (
    <div className="space-y-4">
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

      {data.customFields.map((field) => (
        <div key={field.fieldId} className="overflow-x-auto">
          <table className="w-full min-w-[320px] border-collapse border border-slate-300 text-sm">
            <thead>
              <tr>
                <th colSpan={field.options.length} className={thClass}>
                  {field.label}
                </th>
              </tr>
              <tr>
                {field.options.map((option) => (
                  <th key={option} className={thClass}>
                    {option}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {field.options.map((option) => (
                  <td key={option} className={tdClass}>
                    {field.byOption[option] ?? 0}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      ))}
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

function CustomFieldMetricSubHeaders({
  options,
}: {
  options: string[];
}) {
  return (
    <>
      {options.flatMap((option) => [
        <th key={`${option}-score`} className={thClass}>
          점수
        </th>,
        <th key={`${option}-rank`} className={thClass}>
          순위
        </th>,
      ])}
    </>
  );
}

function TextDemographicMatrix({
  ageGroups,
  rank1Names,
  byRank1Demographic,
  showRank1Headers = true,
}: {
  ageGroups: AgeGroup[];
  rank1Names: string[];
  byRank1Demographic: Record<string, Record<string, string[]>>;
  showRank1Headers?: boolean;
}) {
  const genders: Gender[] = ["male", "female"];
  const hideRank1 =
    rank1Names.length === 1 && rank1Names[0] === "전체";

  return (
    <div className="space-y-4">
      {rank1Names.map((rank1Name) => {
        const cells = byRank1Demographic[rank1Name] ?? {};

        return (
          <div key={rank1Name}>
            {showRank1Headers && !hideRank1 && (
              <h4 className="mb-2 text-base font-semibold">{rank1Name}</h4>
            )}
            <table className="w-full min-w-[480px] border-collapse border border-slate-300 text-sm">
              <thead>
                <tr>
                  {ageGroups.map((age) => (
                    <th key={age} colSpan={2} className={thClass}>
                      {AGE_GROUP_LABELS[age]}
                    </th>
                  ))}
                </tr>
                <tr>
                  {ageGroups.flatMap((age) =>
                    genders.map((gender) => (
                      <th key={`${age}-${gender}`} className={thClass}>
                        {GENDER_LABELS[gender]}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {ageGroups.flatMap((age) =>
                    genders.map((gender) => {
                      const key = demographicKey(age, gender);
                      const responses = cells[key] ?? [];

                      return (
                        <td
                          key={`${rank1Name}-${key}`}
                          className={`${tdClass} text-left align-top`}
                        >
                          {responses.length === 0 ? (
                            <span className="text-muted">-</span>
                          ) : (
                            <div className="space-y-1">
                              {responses.map((response, index) => (
                                <p key={`${rank1Name}-${key}-${index}`}>
                                  {response}
                                </p>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

export function ScoreSectionTable({
  section,
  tableLabel,
}: {
  section: ScoreSectionStats;
  tableLabel?: string;
}) {
  const { ageGroups, customField } = section;
  const customColSpan = customField ? customField.options.length * 2 : 0;
  const demoColSpan = ageGroups.length * 4;
  const categoryRowSpans = getCategoryRowSpans(section.items);
  const headerLabel = tableLabel ?? section.sectionTitle;
  const totalColSpan = 4 + customColSpan + demoColSpan;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse border border-slate-300 text-sm">
        <thead>
          <tr>
            <th colSpan={totalColSpan} className={thClass}>
              {headerLabel}
            </th>
          </tr>
          <tr>
            <th rowSpan={3} className={thClass}>
              구분
            </th>
            <th rowSpan={3} className={thClass}>
              디자인 안
            </th>
            <th colSpan={2} className={thClass}>
              평균
            </th>
            {customField && (
              <th colSpan={customColSpan} className={thClass}>
                {customField.label}
              </th>
            )}
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
            {customField?.options.map((option) => (
              <th key={option} colSpan={2} className={thClass}>
                {option}
              </th>
            ))}
            <DemographicHeaders ageGroups={ageGroups} />
          </tr>
          <tr>
            <DemographicSubHeaders ageGroups={ageGroups} />
          </tr>
          <tr>
            <th className={thClass} colSpan={2} />
            <th className={thClass} colSpan={2} />
            {customField && (
              <CustomFieldMetricSubHeaders options={customField.options} />
            )}
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
              {customField?.options.map((option) => {
                const cell =
                  item.byCustomField[
                    scoreCustomFieldKey(customField.fieldId, option)
                  ];
                return [
                  <td
                    key={`${item.itemId}-custom-${option}-s`}
                    className={tdClass}
                  >
                    {formatNum(cell?.score)}
                  </td>,
                  <td
                    key={`${item.itemId}-custom-${option}-r`}
                    className={tdClass}
                  >
                    {formatNum(cell?.rank)}
                  </td>,
                ];
              })}
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

function formatComparisonCell(cell: {
  count: number;
  answered: number;
  percent: number;
}): string {
  if (cell.answered === 0) return "-";
  return `${cell.percent}% (${cell.count})`;
}

function groupComparisonSegments(segments: ComparisonSegment[]) {
  const groups: { label: string; segments: ComparisonSegment[] }[] = [];

  for (const segment of segments) {
    const last = groups[groups.length - 1];
    if (last && last.label === segment.groupLabel) {
      last.segments.push(segment);
      continue;
    }
    groups.push({ label: segment.groupLabel, segments: [segment] });
  }

  return groups;
}

export function ChoiceComparisonSectionTable({
  section,
  tableLabel,
}: {
  section: ChoiceComparisonSectionStats;
  tableLabel?: string;
}) {
  const segments =
    section.rankBlocks[0]?.segments ?? [];
  const segmentGroups = groupComparisonSegments(segments);
  const rows = section.rankBlocks[0]?.rows ?? [];
  const categoryRowSpans = getCategoryRowSpans(rows);
  const rankColSpan = segments.length;
  const leftColSpan = 2;

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse border border-slate-300 text-sm">
          <thead>
            <tr>
              <th
                colSpan={leftColSpan + rankColSpan * section.rankBlocks.length}
                className={thClass}
              >
                {tableLabel ?? section.sectionTitle}
              </th>
            </tr>
            <tr>
              <th rowSpan={3} className={thClass}>
                구분
              </th>
              <th rowSpan={3} className={thClass}>
                평가 항목
              </th>
              {section.rankBlocks.map((block) => (
                <th key={block.rank1Name} colSpan={rankColSpan} className={thClass}>
                  {block.rank1Name}
                </th>
              ))}
            </tr>
            <tr>
              {section.rankBlocks.map((block) =>
                segmentGroups.map((group) => (
                  <th
                    key={`${block.rank1Name}-${group.label}`}
                    colSpan={group.segments.length}
                    className={thClass}
                  >
                    {group.label}
                  </th>
                ))
              )}
            </tr>
            <tr>
              {section.rankBlocks.map((block) =>
                segments.map((segment) => (
                  <th
                    key={`${block.rank1Name}-${segment.key}`}
                    className={thClass}
                  >
                    {segment.label}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.questionId}>
                {row.category ? (
                  <>
                    {categoryRowSpans[index] !== null && (
                      <td
                        rowSpan={categoryRowSpans[index]!}
                        className={`${tdClass} align-middle font-medium`}
                      >
                        {row.category}
                      </td>
                    )}
                    <td className={`${tdClass} text-left`}>{row.itemLabel}</td>
                  </>
                ) : (
                  <td
                    colSpan={2}
                    className={`${tdClass} text-left font-medium`}
                  >
                    {row.itemLabel}
                  </td>
                )}
                {section.rankBlocks.map((block) => {
                  const blockRow = block.rows.find(
                    (item) => item.questionId === row.questionId
                  );
                  return segments.map((segment) => (
                    <td
                      key={`${block.rank1Name}-${row.questionId}-${segment.key}`}
                      className={tdClass}
                      title={
                        blockRow?.cells[segment.key]?.answered
                          ? `${blockRow.cells[segment.key].count}/${blockRow.cells[segment.key].answered}명`
                          : undefined
                      }
                    >
                      {formatComparisonCell(
                        blockRow?.cells[segment.key] ?? {
                          count: 0,
                          answered: 0,
                          percent: 0,
                        }
                      )}
                    </td>
                  ));
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">
          {section.comparisonMode === "rank1"
            ? `각 셀은 해당 ${section.rankingQuestionTitle} 1순위·구간 응답자 중 해당 안과 일치하는 선택지를 고른 비율(%)입니다.`
            : `각 셀은 해당 구간 응답자 중 ${section.rankingQuestionTitle} 문항의 해당 선택지를 고른 비율(%)입니다.`}{" "}
          마우스를 올리면 선택 인원/응답 인원을 볼 수 있습니다.
        </p>
      </div>

      <div className="overflow-x-auto">
        <p className="mb-2 text-sm font-medium">{section.reasonTitle}</p>
        {section.reasonDemographic.rank1Names.some(
          (name) => name !== "전체"
        ) && (
          <p className="mb-2 text-xs text-muted">최종 디자인 1순위 기준</p>
        )}
        {section.reasonDemographic.ageGroups.length === 0 ? (
          <p className="text-sm text-muted">제출된 주관식 답변이 없습니다.</p>
        ) : (
          <TextDemographicMatrix
            ageGroups={section.reasonDemographic.ageGroups}
            rank1Names={section.reasonDemographic.rank1Names}
            byRank1Demographic={section.reasonDemographic.byRank1Demographic}
          />
        )}
      </div>
    </div>
  );
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
                  <td className={tdClass}>
                    {row.percent}% ({row.count})
                  </td>
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
              <td className={tdClass}>
                {row.percent}% ({row.count})
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TextSectionTable({
  section,
  tableLabel,
}: {
  section: TextSectionStats;
  tableLabel?: string;
}) {
  const headerLabel = tableLabel ?? "주관식";
  const hasResponses = section.demographicItems.some((item) =>
    section.rank1Names.some((rank1Name) =>
      Object.values(item.byRank1Demographic[rank1Name] ?? {}).some(
        (responses) => responses.length > 0
      )
    )
  );

  return (
    <div className="space-y-5">
      <p className="text-sm font-medium text-muted">{headerLabel}</p>
      {section.groupedByFinalDesignRank1 && (
        <p className="text-xs text-muted">최종 디자인 1순위 기준</p>
      )}
      {!hasResponses ? (
        <p className="text-sm text-muted">제출된 주관식 답변이 없습니다.</p>
      ) : (
        section.demographicItems.map((item) => (
          <div key={item.questionId} className="space-y-3">
            {section.demographicItems.length > 1 && (
              <p className="text-sm font-medium">{item.questionTitle}</p>
            )}
            <TextDemographicMatrix
              ageGroups={section.ageGroups}
              rank1Names={section.rank1Names}
              byRank1Demographic={item.byRank1Demographic}
            />
          </div>
        ))
      )}
    </div>
  );
}

export function ScoreCompareSectionTable({
  section,
}: {
  section: ScoreCompareSectionStats;
}) {
  const hasReasonCategories = section.reasonCategories.some((category) =>
    category.blocks.some((block) => block.entries.length > 0)
  );

  return (
    <div className="space-y-6">
      <ScoreCompareScoreTable
        sectionTitle={section.sectionTitle}
        scoreStats={section.scoreStats}
      />

      {hasReasonCategories && (
        <div className="space-y-4">
          {section.reasonCategories.map((category) => (
            <div key={category.category} className="space-y-4">
              <p className="text-sm font-medium">
                {category.category} — 고득점 디자인 안 선호 이유
              </p>
              <ScoreCompareReasonViewer
                categories={[category]}
                demographicFields={section.demographicFields}
                ageGroups={section.ageGroups}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderDashboardTable(entry: DashboardTableEntry) {
  const { table } = entry;
  const tableLabel = dashboardTableTitle(entry);

  switch (table.type) {
    case "score":
      return (
        <ScoreSectionTable
          key={entry.key}
          section={table.data}
          tableLabel={tableLabel}
        />
      );
    case "score-compare":
      return (
        <ScoreCompareSectionTable key={entry.key} section={table.data} />
      );
    case "ranking":
      return (
        <RankingSectionTable
          key={entry.key}
          section={table.data}
          tableLabel={tableLabel}
        />
      );
    case "text":
      return (
        <TextSectionTable
          key={entry.key}
          section={table.data}
          tableLabel={tableLabel}
        />
      );
    case "choice-comparison":
      return (
        <ChoiceComparisonSectionTable
          key={entry.key}
          section={table.data}
          tableLabel={tableLabel}
        />
      );
    case "choice":
      return (
        <ChoiceSectionTable
          key={entry.key}
          section={table.data}
          tableLabel={tableLabel}
        />
      );
    default:
      return null;
  }
}

export function DashboardSectionTables({ stats }: { stats: DashboardStats }) {
  const sectionGroups = [...stats.sectionGroups].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <DemographicTable data={stats.demographics} />
      </div>

      {sectionGroups.map((section) => {
        if (section.tables.length === 0) return null;

        return (
          <div
            key={section.sectionId}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <h3 className="text-lg font-semibold">{section.sectionTitle}</h3>
            <div className="mt-4 space-y-6">
              {section.tables.map((table) => {
                const entry: DashboardTableEntry = {
                  key: dashboardTableKey(section.sectionId, table),
                  sectionId: section.sectionId,
                  sectionTitle: section.sectionTitle,
                  sectionSortOrder: section.sortOrder,
                  table,
                };
                return renderDashboardTable(entry);
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
