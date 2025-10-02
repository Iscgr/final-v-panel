/**
 * Representatives Table Columns Definition
 * ستون‌های جدول نمایندگان با قابلیت sort
 */

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ExternalLink } from "lucide-react";
import { Link } from "wouter";

export interface RepresentativeRow {
  id: number;
  code: string;
  name: string;
  ownerName: string;
  totalSales: string;
  totalDebt: string;
  panelUsername: string;
}

export const representativesColumns: ColumnDef<RepresentativeRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="text-right w-full justify-start"
        >
          نام فروشگاه
          <ArrowUpDown className="mr-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      return (
        <div className="text-right font-medium">{row.getValue("name")}</div>
      );
    },
  },
  {
    accessorKey: "ownerName",
    header: "همکار فروش",
    cell: ({ row }) => {
      return (
        <div className="text-right">{row.getValue("ownerName")}</div>
      );
    },
  },
  {
    accessorKey: "totalSales",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="text-right w-full justify-start"
        >
          میزان فروش کل (تومان)
          <ArrowUpDown className="mr-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      // ✅ ODIN v5.0: Values are already in Toman from backend
      const amount = parseFloat(row.getValue("totalSales"));
      const formatted = new Intl.NumberFormat("fa-IR").format(amount);
      return <div className="text-right font-medium">{formatted}</div>;
    },
  },
  {
    accessorKey: "totalDebt",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="text-right w-full justify-start"
        >
          مانده بدهی (تومان)
          <ArrowUpDown className="mr-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      // ✅ ODIN v5.0: Values are already in Toman from backend
      const amount = parseFloat(row.getValue("totalDebt"));
      const formatted = new Intl.NumberFormat("fa-IR").format(amount);
      
      // رنگ‌بندی بر اساس میزان بدهی (در تومان)
      const colorClass = amount > 1000000 
        ? "text-red-600 font-bold" 
        : amount > 500000 
        ? "text-orange-600 font-semibold"
        : "text-green-600";
      
      return <div className={`text-right ${colorClass}`}>{formatted}</div>;
    },
  },
  {
    id: "actions",
    header: "ورود به پروفایل",
    cell: ({ row }) => {
      const rep = row.original;
      
      return (
        <div className="flex justify-center">
          <Link href={`/representatives/${rep.code}`}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-blue-100 hover:text-blue-600"
              title="ورود به پروفایل نماینده"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      );
    },
  },
];
