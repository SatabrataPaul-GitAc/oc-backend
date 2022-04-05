const { getMyCommits, getMyPullRequests } = require('../helpers/github.helper');
const ejs = require('ejs');
const path = require('path');
const Certificate = require('../models/certificate.model');
const NotFoundError = require('../errors/notFound.error');
const CustomError = require('../errors/custom.error');
const getLastContributionDate = (latestCommit, latestPullRequest) => {
    if (!latestCommit) {
        return latestPullRequest;
    }
    if (!latestPullRequest) {
        return latestCommit;
    }
    latestCommit = new Date(latestCommit);
    latestPullRequest = new Date(latestPullRequest);
    return latestCommit > latestPullRequest ? latestCommit : latestPullRequest;
};

exports.generateCertificate = async (req, res, next) => {
    try {
        const user = req.user;
        // console.log(user);
        const project = req.project;

        const [commits, pullRequests] = await Promise.all([
            getMyCommits(user.accessToken, project.owner, project.name),
            getMyPullRequests(user.accessToken, project.owner, project.name)
        ]);

        if (
            commits.data.total_count == 0 &&
            pullRequests.data.total_count == 0
        ) {
            throw new CustomError('No commits found by user');
        }

        const images = [project.provider];

        const lastContributionDate = getLastContributionDate(
            commits.data.items[0]?.commit?.committer?.date,
            pullRequests.data.items[0]?.created_at
        );

        if (req.body.includeRepositoryImage) {
            images.push({
                src: project.ownerAvatar,
                url: project.repoLink
            });
        }
        if (req.body.includeUserImage) {
            images.push({
                src: user.avatar,
                url: user.profileUrl
            });
        }
        const certificate = await Certificate.create({
            userGithubId: user.username,
            userName: user.name,
            projectRepo: project.name,
            projectOwner: project.owner,
            commitCount: commits.data.total_count,
            pullRequestCount: pullRequests.data.total_count,
            lastContributionDate,
            images
        });
        return res.status(200).json({
            certificate
        });
    } catch (e) {
        next(e);
    }
};

exports.getCert = async (req, res, next) => {
    try {
        const certificate = await Certificate.getById(req.params.id).lean();
        if (!certificate) {
            throw new NotFoundError('Invalid Certificate Id');
        }
        // console.log({
        //     ...certificate,
        //     verifyAt: `${process.env.BASE_URL}/certificate/${certificate._id}`
        // });
        return res.render('certificateHolder', {
            html: await ejs.renderFile(
                path.join(__dirname, '../views/certificate.ejs'),
                {
                    data: {
                        ...certificate,
                        verifyAt: `${process.env.BASE_URL}/certificate/${certificate._id}`
                    }
                }
            )
        });
    } catch (e) {
        next(e);
    }
};

exports.getCertDetails = async (req, res, next) => {
    try {
        const cert_id = req.params.id;

        const certificate = await Certificate.getById(cert_id);
        if (!certificate) {
            throw new NotFoundError('Invalid Certificate Id');
        }

        res.status(200).json({
            certificate
        });
    } catch (e) {
        next(e);
    }
};
