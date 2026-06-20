import type {
  AgeGroup,
  CombinedReasonSectionStats,
  DashboardStats,
  DemographicFieldConfig,
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
import { formatChoiceSegmentCell, getChoiceItemLabelRowSpans } from "@/lib/choice-dashboard-stats";
import { TextReasonViewer } from "@/components/admin/text-reason-viewer";
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

function DemographicSegmentTable<T>({
  sectionTitle,
  segments,
  items,
  getValueLabel,
  formatCell,
}: {
  sectionTitle: string;
  segments: ComparisonSegment[];
  items: Array<{
    itemId: string;
    category: string;
    valueLabel: string;
    bySegment: Record<string, T | null | undefined>;
  }>;
  getValueLabel: (item: { valueLabel: string }) => string;
  formatCell: (value: T | null | undefined) => string;
}) {
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
              <td className={tdClass}>{getValueLabel(item)}</td>
              {segments.map((segment) => (
                <td key={`${item.itemId}-${segment.key}`} className={tdClass}>
                  {formatCell(item.bySegment[segment.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChoiceDashboardTable({
  sectionTitle,
  dashboardStats,
}: {
  sectionTitle: string;
  dashboardStats: NonNullable<ChoiceSectionStats["dashboardStats"]>;
}) {
  const { segments, items } = dashboardStats;
  const segmentGroups = groupSegmentHeaderSpans(segments);
  const categoryRowSpans = getCategoryRowSpans(
    items.map((item) => ({ category: item.category ?? "" }))
  );
  const itemLabelRowSpans = getChoiceItemLabelRowSpans(items);
  const totalColSpan = 3 + segments.length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[840px] border-collapse border border-slate-300 text-sm">
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
              평가 항목
            </th>
            <th rowSpan={2} className={thClass}>
              선택지
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
              {item.category ? (
                <>
                  {categoryRowSpans[index] !== null && (
                    <td
                      rowSpan={categoryRowSpans[index]!}
                      className={`${tdClass} align-middle font-medium`}
                    >
                      {item.category}
                    </td>
                  )}
                  {itemLabelRowSpans[index] !== null && (
                    <td
                      rowSpan={itemLabelRowSpans[index]!}
                      className={`${tdClass} text-left align-middle`}
                    >
                      {item.itemLabel}
                    </td>
                  )}
                </>
              ) : (
                <>
                  {itemLabelRowSpans[index] !== null && (
                    <td
                      rowSpan={itemLabelRowSpans[index]!}
                      className={`${tdClass} align-middle font-medium`}
                    >
                      {item.itemLabel}
                    </td>
                  )}
                  {itemLabelRowSpans[index] !== null && (
                    <td rowSpan={itemLabelRowSpans[index]!} className={tdClass} />
                  )}
                </>
              )}
              <td className={`${tdClass} text-left`}>{item.option}</td>
              {segments.map((segment) => (
                <td key={`${item.itemId}-${segment.key}`} className={tdClass}>
                  {formatChoiceSegmentCell(item.bySegment[segment.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScoreCompareScoreTable({
  sectionTitle,
  scoreStats,
}: {
  sectionTitle: string;
  scoreStats: ScoreCompareScoreStats;
}) {
  return (
    <DemographicSegmentTable
      sectionTitle={sectionTitle}
      segments={scoreStats.segments}
      items={scoreStats.items.map((item) => ({
        itemId: item.itemId,
        category: item.category,
        valueLabel: item.combination,
        bySegment: item.bySegment,
      }))}
      getValueLabel={(item) => item.valueLabel}
      formatCell={formatNum}
    />
  );
}

export function DemographicTable({ data }: { data: DemographicStats }) {
  const ageGroups = data.ageGroups;
  const customColCount = data.customFields.reduce(
    (sum, field) => sum + field.options.length,
    0
  );
  const totalColSpan = 1 + 2 + ageGroups.length + customColCount;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse border border-slate-300 text-sm">
        <thead>
          <tr>
            <th colSpan={totalColSpan} className={thClass}>
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
            {data.customFields.map((field) => (
              <th
                key={field.fieldId}
                colSpan={field.options.length}
                className={thClass}
              >
                {field.label}
              </th>
            ))}
          </tr>
          <tr>
            <th className={thClass}>남</th>
            <th className={thClass}>여</th>
            {ageGroups.map((age) => (
              <th key={age} className={thClass}>
                {AGE_GROUP_LABELS[age]}
              </th>
            ))}
            {data.customFields.flatMap((field) =>
              field.options.map((option) => (
                <th key={`${field.fieldId}-${option}`} className={thClass}>
                  {option}
                </th>
              ))
            )}
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
            {data.customFields.flatMap((field) =>
              field.options.map((option) => (
                <td key={`${field.fieldId}-${option}`} className={tdClass}>
                  {field.byOption[option] ?? 0}
                </td>
              ))
            )}
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

export function CombinedReasonSectionTable({
  section,
  tableLabel,
}: {
  section: CombinedReasonSectionStats;
  tableLabel?: string;
}) {
  const headerLabel = tableLabel ?? section.tableLabel;

  return (
    <div className="space-y-5">
      <p className="text-sm font-medium text-muted">{headerLabel}</p>
      <TextReasonViewer
        title={section.viewerTitle}
        entries={section.entries}
        answerGroups={section.answerGroups}
        demographicFields={section.demographicFields}
        ageGroups={section.ageGroups}
      />
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
    <div className="space-y-6">
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
    <div className="space-y-6">
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

  if (section.dashboardStats) {
    return (
      <ChoiceDashboardTable
        sectionTitle={headerLabel}
        dashboardStats={section.dashboardStats}
      />
    );
  }

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

  return null;
}

export function TextSectionTable({
  section,
  tableLabel,
}: {
  section: TextSectionStats;
  tableLabel?: string;
}) {
  const headerLabel = tableLabel ?? "주관식";
  const hideRank1 =
    section.rank1Names.length === 1 && section.rank1Names[0] === "전체";
  const hasResponses = section.demographicItems.some((item) =>
    section.rank1Names.some(
      (rank1Name) => (item.entriesByRank1[rank1Name] ?? []).length > 0
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
          <div key={item.questionId} className="space-y-4">
            {section.rank1Names.map((rank1Name) => {
              const entries = item.entriesByRank1[rank1Name] ?? [];
              if (entries.length === 0) return null;

              const viewerTitle =
                section.demographicItems.length > 1
                  ? hideRank1
                    ? item.questionTitle
                    : `${rank1Name} — ${item.questionTitle}`
                  : hideRank1
                    ? headerLabel
                    : rank1Name;

              return (
                <TextReasonViewer
                  key={`${item.questionId}-${rank1Name}`}
                  title={viewerTitle}
                  entries={entries}
                  demographicFields={section.demographicFields}
                  ageGroups={section.ageGroups}
                />
              );
            })}
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
  return (
    <ScoreCompareScoreTable
      sectionTitle={section.sectionTitle}
      scoreStats={section.scoreStats}
    />
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
    case "combined-reason":
      return (
        <CombinedReasonSectionTable
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
