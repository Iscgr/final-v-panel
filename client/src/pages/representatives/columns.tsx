// src/pages/representatives/columns.tsx
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, MoreHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// This type is a placeholder, replace with your actual data type
export type Representative = {
  id: string
  name: string
  status: "active" | "inactive" | "pending"
  email: string
  region: string
  lastActivity: string
}

export const columns: ColumnDef<Representative>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() ? "indeterminate" : false)
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="انتخاب همه"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="انتخاب ردیف"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          نام
          <ArrowUpDown className="mr-2 h-4 w-4" />
        </Button>
      )
    },
  },
  {
    accessorKey: "status",
    header: "وضعیت",
    cell: ({ row }) => {
        const status = row.getValue("status") as string;
        const statusMap = {
            active: { text: "فعال", color: "bg-green-500" },
            inactive: { text: "غیرفعال", color: "bg-red-500" },
            pending: { text: "در انتظار", color: "bg-yellow-500" },
        };
        const { text, color } = statusMap[status as keyof typeof statusMap] || { text: status, color: "bg-gray-500" };

        return <div className="flex items-center">
            <span className={`h-2 w-2 rounded-full ${color} ml-2`}></span>
            {text}
        </div>
    }
  },
  {
    accessorKey: "email",
    header: "ایمیل",
  },
  {
    accessorKey: "region",
    header: "منطقه",
  },
  {
    accessorKey: "lastActivity",
    header: "آخرین فعالیت",
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const representative = row.original
 
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">باز کردن منو</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>عملیات</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(representative.id)}
            >
              کپی شناسه
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>مشاهده پروفایل</DropdownMenuItem>
            <DropdownMenuItem>ویرایش</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
