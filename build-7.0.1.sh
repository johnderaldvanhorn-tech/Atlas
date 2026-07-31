#!/bin/bash

set -e

echo "====================================="
echo " Project Portfolio Planner v7.0.1"
echo " Repository Foundation Build"
echo "====================================="

PROJECT=~/Projects/project-portfolio-planner

cd "$PROJECT"

##########################################
# Update Version
##########################################

echo "Updating version..."

perl -pi -e "s/APP_VERSION\s*=\s*['\"][^'\"]+['\"]/APP_VERSION='7.0.1'/g" version.js

##########################################
# Backup
##########################################

mkdir -p backups

STAMP=$(date +%Y%m%d_%H%M%S)

zip -rq "backups/pre-7.0.1-$STAMP.zip" . \
    -x "*.git*" \
    -x "node_modules/*"

##########################################
# Create Repository Layer
##########################################

cat > supabase-service.js <<'EOF'
class ProjectRepository {

    async initialize() {
        return true;
    }

    async testConnection() {
        try {
            const { error } =
                await window.supabase
                .from("projects")
                .select("id")
                .limit(1);

            return !error;
        }
        catch(e){
            console.error(e);
            return false;
        }
    }

    async getProjects(){
        return loadProjectsFromSupabase();
    }

    async saveProject(project){
        return saveProjectToSupabase(project);
    }

    async deleteProject(id){
        return deleteProjectFromSupabase(id);
    }

    async bulkImport(projects){

        for(const p of projects)
            await this.saveProject(p);

        return true;
    }

}

window.ProjectRepository =
    new ProjectRepository();
EOF

##########################################
# Add script reference
##########################################

if ! grep -q "supabase-service.js" index.html; then

perl -0pi -e 's#(<script src="app\.js)#<script src="supabase-service.js"></script>\n$1#g' index.html

fi

##########################################
# Commit
##########################################

git add .

git commit -m "v7.0.1 Repository Foundation"

echo
echo "====================================="
echo "Done."
echo
echo "Next:"
echo "./release.sh 7.0.1"
echo "====================================="
