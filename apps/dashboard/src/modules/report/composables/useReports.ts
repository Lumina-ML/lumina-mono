import { useQuery } from "@tanstack/vue-query";
import { ReportService } from "@/services/report.service";
import type { ListReportsQuery } from "@/types/report";
import type { Ref } from "vue";

export function useReports(params?: Ref<ListReportsQuery>) {
  return useQuery({
    queryKey: ["reports", params?.value],
    queryFn: () => ReportService.list(params?.value),
  });
}

export function useReport(reportId: Ref<string>) {
  return useQuery({
    queryKey: ["report", reportId],
    queryFn: () => ReportService.get(reportId.value),
    enabled: () => !!reportId.value,
  });
}