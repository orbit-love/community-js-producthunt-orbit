#!/usr/bin/env node

const OrbitProductHunt = require('./index.js')
const args = require('yargs').argv

async function main() {
    const hasEnvVars = process.env.ORBIT_WORKSPACE_ID && process.env.ORBIT_API_KEY && process.env.PRODUCT_HUNT_API_KEY && process.env.PRODUCT_HUNT_API_SECRET
    const hasVoteReqs = args.votes && args.id
    const hasProductReqs = args.products && args.user
    const hasBothReqs = args.votes && args.products

    if(!hasEnvVars || !(hasVoteReqs || hasProductReqs) || hasBothReqs) {
        return console.error(`
        You may only run any of the following commands:
        npx @orbit-love/producthunt --products --user=username
        npx @orbit-love/producthunt --votes --id=projectid --hours=12
        npx @orbit-love/producthunt --comments --id=projectid --hours=12

        If --hours is not provided it will default to 1.

        You must also have ORBIT_WORKSPACE_ID, ORBIT_API_KEY, PRODUCT_HUNT_API_KEY & PRODUCT_HUNT_API_SECRET environment variables set.
        `)
    }

    const orbitProductHunt = new OrbitProductHunt()

    if(args.products) {
        const products = await orbitProductHunt.getProducts(args.user)
        console.log(products)
    }

    if(args.votes) {
        const votes = await orbitProductHunt.getVotes(args.id)
        const preparedVoteActivities = await orbitProductHunt.prepareVotes(votes, args.hours)
        const result = await orbitProductHunt.addActivities(preparedVoteActivities)
        console.log(result)
    }

    if(args.comments) {
        const comments = await orbitProductHunt.getComments(args.id)
        const preparedCommentActivities = await orbitProductHunt.prepareComments(comments, args.hours)
        const result = await orbitProductHunt.addActivities(preparedCommentActivities)
        console.log(result)
    }
}

main()
