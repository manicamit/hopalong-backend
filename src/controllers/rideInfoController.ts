import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import handleError from "../utils/handleErrors";

const client = new PrismaClient();
 


export const particularRide = async (req:any, res:any) => {
    const { rideId } = req.body;   

    try {
        const rideRecords = await client.rideInfo.findMany({
            where: { rideId: rideId },
            select: {
                startPoint: true,
                endPoint: true,
                Date: true,
                totalCost: true,
                distTravelled: true,
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        profilePic: true
                    }
                }
            }
        });

        if (rideRecords.length === 0) {
            return res.status(404).json({status:"error",payload:{ message: "Ride not found"} });
        }
 

        const rideInfo = rideRecords.map(record => ({
            startPoint: record.startPoint,
            endPoint: record.endPoint,
            totalCost: record.totalCost,
            distTravelled: record.distTravelled,
            Date: record.Date,
            user: record.user
        }));

        res.status(200).json({
            status: "success",
            payload: { rideInfo }
        });


    } catch (e) {
        handleError(e, res);
    }
};



export const allRides = async (req: Request, res: Response) => {
    try{
        const allRides = await client.rideInfo.findMany({
            distinct: ["rideId"],
            select : { 
                rideId : true,
                Date: true,
                startPoint : true,
                endPoint : true
            }
        });

        

        res.status(200).json({
            status :"success",
            payload :{ 
                allRides
            }
        });  
        return;
    }catch(e){
        handleError(e,res);
        return;
    }
}