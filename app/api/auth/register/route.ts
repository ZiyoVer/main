import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db/prisma"

export async function POST(req: Request) {
    try {
        const { email, password, name, role } = await req.json()
        const hashedPassword = await bcrypt.hash(password, 10)

        const user = await prisma.user.create({
            data: {
                email,
                name,
                password: hashedPassword,
                role: role || "STUDENT"
            }
        })

        return NextResponse.json({ message: "User created" }, { status: 201 })
    } catch (e) {
        return NextResponse.json({ message: "Error creating user" }, { status: 500 })
    }
}
